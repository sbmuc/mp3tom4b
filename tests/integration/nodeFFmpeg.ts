/**
 * Runs the exact ffmpeg-core the site ships (public/ffmpeg/) in Node, behind the
 * same small API surface convert.ts uses from @ffmpeg/ffmpeg. Lets the
 * integration test drive the real conversion code without a browser.
 */
import { createRequire } from 'node:module'
import path from 'node:path'

interface Core {
  FS: {
    writeFile(p: string, d: Uint8Array | string): void
    readFile(p: string): Uint8Array
    unlink(p: string): void
    mkdir(p: string): void
    rmdir(p: string): void
  }
  exec(...args: string[]): number
  ret: number
  reset(): void
  setLogger(cb: (e: { type: string; message: string }) => void): void
  setProgress(cb: (e: { progress: number; time: number }) => void): void
  setTimeout(ms: number): void
}

// The patched JS with the stock wasm, as client.ts loads them in the browser.
const CORE_JS = path.resolve(__dirname, '../../public/ffmpeg/0.12.6-p1/ffmpeg-core.js')
const CORE_WASM = path.resolve(__dirname, '../../public/ffmpeg/0.12.6/ffmpeg-core.wasm')
const loadCore = createRequire(__filename)(CORE_JS) as (opts?: object) => Promise<Core>
// The core takes the wasm location from the hash of mainScriptUrlOrBlob.
const createCore = () =>
  loadCore({ mainScriptUrlOrBlob: `${CORE_JS}#${Buffer.from(JSON.stringify({ wasmURL: CORE_WASM })).toString('base64')}` })

type LogCb = (e: { type: string; message: string }) => void
type ProgressCb = (e: { progress: number; time: number }) => void

export class NodeFFmpeg {
  private logCbs = new Set<LogCb>()
  private progressCbs = new Set<ProgressCb>()

  private constructor(private core: Core) {
    core.setLogger((e) => this.logCbs.forEach((cb) => cb(e)))
    core.setProgress((e) => this.progressCbs.forEach((cb) => cb(e)))
  }

  static async create(): Promise<NodeFFmpeg> {
    return new NodeFFmpeg(await createCore())
  }

  on(event: 'log', cb: LogCb): void
  on(event: 'progress', cb: ProgressCb): void
  on(event: 'log' | 'progress', cb: LogCb | ProgressCb) {
    if (event === 'log') this.logCbs.add(cb as LogCb)
    else this.progressCbs.add(cb as ProgressCb)
  }

  off(event: 'log', cb: LogCb): void
  off(event: 'progress', cb: ProgressCb): void
  off(event: 'log' | 'progress', cb: LogCb | ProgressCb) {
    if (event === 'log') this.logCbs.delete(cb as LogCb)
    else this.progressCbs.delete(cb as ProgressCb)
  }

  // Mirrors @ffmpeg/ffmpeg's worker: exec, read ret, reset.
  async exec(args: string[]): Promise<number> {
    this.core.setTimeout(-1)
    this.core.exec(...args)
    const ret = this.core.ret
    this.core.reset()
    return ret
  }

  /**
   * exec + the log lines it printed. For test setup/analysis only. Sets `-v info`
   * each time: the log level persists across runs on one core instance.
   */
  async run(args: string[]): Promise<{ ret: number; log: string[] }> {
    const log: string[] = []
    const cb: LogCb = ({ message }) => log.push(message)
    this.on('log', cb)
    try {
      return { ret: await this.exec(['-hide_banner', '-v', 'info', ...args]), log }
    } finally {
      this.off('log', cb)
    }
  }

  async writeFile(p: string, data: Uint8Array | string) {
    this.core.FS.writeFile(p, data)
    return true
  }

  async readFile(p: string): Promise<Uint8Array> {
    return this.core.FS.readFile(p)
  }

  async deleteFile(p: string) {
    this.core.FS.unlink(p)
    return true
  }

  async createDir(p: string) {
    this.core.FS.mkdir(p)
    return true
  }

  async deleteDir(p: string) {
    this.core.FS.rmdir(p)
    return true
  }

  // WORKERFS reads through FileReaderSync, which only browser workers have.
  // Copying the files in gives ffmpeg the same paths and bytes.
  private mounts = new Map<string, string[]>()

  async mount(_type: string, opts: { files?: File[]; blobs?: { name: string; data: Blob }[] }, mountPoint: string) {
    if (this.mounts.has(mountPoint)) throw new Error(`${mountPoint} is already mounted`)
    const entries = [...(opts.files ?? []).map((f) => ({ name: f.name, data: f as Blob })), ...(opts.blobs ?? [])]
    const paths: string[] = []
    for (const e of entries) {
      const p = `${mountPoint}/${e.name}`
      this.core.FS.writeFile(p, new Uint8Array(await e.data.arrayBuffer()))
      paths.push(p)
    }
    this.mounts.set(mountPoint, paths)
    return true
  }

  async unmount(mountPoint: string) {
    const paths = this.mounts.get(mountPoint)
    if (!paths) throw new Error(`${mountPoint} is not mounted`)
    for (const p of paths) this.core.FS.unlink(p)
    this.mounts.delete(mountPoint)
    return true
  }

  terminate() {}
}

let singleton: Promise<NodeFFmpeg> | null = null

/** Drop-in for '@/lib/ffmpeg/client' (see vi.mock in the test). */
export const clientMock = {
  getFFmpeg: () => (singleton ??= NodeFFmpeg.create()),
  createWorkerFFmpeg: () => NodeFFmpeg.create(),
  releaseWorkerFFmpeg: (ff: NodeFFmpeg) => ff.terminate(),
  ffmpegLoadingLabel: () => 'Loading converter…',
  isFFmpegLoaded: () => singleton !== null,
  terminateFFmpeg: () => {},
}
