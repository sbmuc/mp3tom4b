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
  }
  exec(...args: string[]): number
  ret: number
  reset(): void
  setLogger(cb: (e: { type: string; message: string }) => void): void
  setProgress(cb: (e: { progress: number; time: number }) => void): void
  setTimeout(ms: number): void
}

const CORE_JS = path.resolve(__dirname, '../../public/ffmpeg/0.12.6/ffmpeg-core.js')
const createCore = createRequire(__filename)(CORE_JS) as (opts?: object) => Promise<Core>

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
