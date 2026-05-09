'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { AudioFile, Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { resizeCoverImage } from '@/lib/image/resize'
import { buildChapters, buildFFMetadata } from './chapters'
import { createWorkerFFmpeg, getFFmpeg, releaseWorkerFFmpeg } from './client'
import { probeDurationMs } from './probe'

// Mutex for the singleton FFmpeg instance. Concurrent calls into the same
// ffmpeg.wasm instance corrupt its wasm heap (manifests as
// "RuntimeError: memory access out of bounds"), even though the JS API queues
// messages — the MT core's SharedArrayBuffer-backed memory is particularly
// sensitive. Parallel workers must serialize their writes to the singleton.
let singletonOpLock: Promise<void> = Promise.resolve()
async function withSingleton<T>(op: (ffmpeg: FFmpeg) => Promise<T>): Promise<T> {
  const previous = singletonOpLock
  let release!: () => void
  singletonOpLock = new Promise<void>((r) => {
    release = r
  })
  try {
    await previous
    const ffmpeg = await getFFmpeg()
    return await op(ffmpeg)
  } finally {
    release()
  }
}

export interface ConvertOptions {
  files: AudioFile[]
  metadata: ConversionMetadata
  coverFile: File | null
  bitrate: Bitrate
  onProgress?: (p: ConversionProgress) => void
}

const inputName = (i: number, ext: string) => `input_${i}.${ext}`
const encodedName = (i: number) => `enc_${i}.m4a`
const LIST_PATH = 'concat_list.txt'
const META_PATH = 'chapters.ffmeta'
const COVER_PATH = 'cover.jpg'
const OUTPUT_PATH = 'output.m4b'

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

async function safeDelete(path: string) {
  const ffmpeg = await getFFmpeg()
  try {
    await ffmpeg.deleteFile(path)
  } catch {
    // ignore
  }
}

/** How many files to encode in parallel. Scales with logical CPU count. */
function encodeConcurrency(fileCount: number): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  // Leave half the cores for the OS + browser main thread.
  // Cap at 3 to keep memory pressure manageable.
  return Math.min(3, fileCount, Math.max(1, Math.floor(cores / 2)))
}

/**
 * Encode all input files to AAC using a pool of parallel ffmpeg worker
 * instances. Each worker handles one file at a time from a shared queue.
 * Encoded outputs are written to the main singleton's virtual FS so that the
 * concat step can read them normally.
 */
async function encodeFilesParallel(
  files: AudioFile[],
  segments: Array<{ ext: string }>,
  bitrate: Bitrate,
  emit: (p: ConversionProgress) => void,
): Promise<void> {
  const total = files.length
  // Per-file encode progress (0–1). Updated by whichever worker holds the file.
  const perFileProgress = new Array<number>(total).fill(0)
  let completedCount = 0

  function emitProgress() {
    const sumProgress = perFileProgress.reduce((a, b) => a + b, 0)
    const overall = 10 + Math.round((sumProgress / total) * 70)
    emit({
      status: 'encoding',
      percent: Math.min(80, overall),
      label: `Encoding chapters… (${completedCount} of ${total} done)`,
    })
  }

  const queue: number[] = Array.from({ length: total }, (_, i) => i)

  async function runWorker() {
    const worker = await createWorkerFFmpeg()
    try {
      while (true) {
        const idx = queue.shift()
        if (idx === undefined) break

        const f = files[idx]
        const ext = segments[idx].ext
        const inPath = inputName(idx, ext)
        const outPath = encodedName(idx)

        const onProgress = ({ progress }: { progress: number }) => {
          perFileProgress[idx] = Math.max(0, Math.min(1, progress))
          emitProgress()
        }
        worker.on('progress', onProgress)

        // Tag any failure with the chapter + step that crashed so the user
        // sees something more useful than a bare wasm error.
        const tagged = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn()
          } catch (err) {
            const orig = err instanceof Error ? err.message : String(err)
            throw new Error(`${step} chapter ${idx + 1}/${total}: ${orig || 'unknown wasm error'}`)
          }
        }

        try {
          await tagged('reading', async () => {
            const sourceBytes = await fetchFile(f.file)
            await worker.writeFile(inPath, sourceBytes)
          })
          await tagged('encoding', () =>
            worker.exec([
              '-hide_banner', '-i', inPath,
              '-vn', '-c:a', 'aac', '-b:a', `${bitrate}k`,
              outPath,
            ]),
          )
          const bytes = await tagged('reading encoded output of', async () => {
            const data = await worker.readFile(outPath)
            const src = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
            const buf = new Uint8Array(src.byteLength)
            buf.set(src)
            return buf
          })
          await tagged('writing encoded output of', () =>
            withSingleton((mainFFmpeg) => mainFFmpeg.writeFile(outPath, bytes)),
          )
        } finally {
          worker.off('progress', onProgress)
          perFileProgress[idx] = 1
          completedCount++
          emitProgress()
          try { await worker.deleteFile(inPath) } catch { /* ignore */ }
          try { await worker.deleteFile(outPath) } catch { /* ignore */ }
        }
      }
    } finally {
      releaseWorkerFFmpeg(worker)
    }
  }

  const concurrency = encodeConcurrency(total)
  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
}

/**
 * Convert a list of audio files into a single chaptered M4B audiobook.
 * All processing happens in-browser via ffmpeg.wasm.
 */
export async function convertToM4B(opts: ConvertOptions): Promise<Blob> {
  const { files, metadata, coverFile, bitrate, onProgress } = opts
  if (files.length === 0) throw new Error('No input files provided.')

  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: 'Loading converter…' })
  const ffmpeg = await getFFmpeg()

  // Track all virtual paths created on the singleton FS so we can clean up.
  const tempPaths: string[] = []

  try {
    // 1. Probe durations
    const segments: Array<{ title: string; durationMs: number; ext: string }> = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = fileExtension(f.file.name)
      emit({
        status: 'probing',
        percent: 2 + Math.round((i / files.length) * 8),
        label: `Reading file ${i + 1} of ${files.length}…`,
      })
      let durationMs: number
      if (f.duration != null && isFinite(f.duration) && f.duration > 0) {
        durationMs = Math.round(f.duration * 1000)
      } else {
        const probeName = `probe_${i}.${ext}`
        durationMs = await probeDurationMs(f.file, probeName)
      }
      segments.push({ title: f.chapterTitle, durationMs, ext })
    }

    // 2. Encode or stream-copy inputs to AAC, then register outputs for cleanup.
    // If every input is already an M4A (AAC in MP4 container), skip re-encoding
    // entirely — write the source file straight to the singleton FS under the
    // enc_N.m4a name so the concat step can stream-copy them at no CPU cost.
    // Any other format goes through the parallel AAC encoding workers.
    const allM4A = segments.every((s) => s.ext === 'm4a')
    if (allM4A) {
      emit({ status: 'encoding', percent: 10, label: 'Copying chapters (already AAC)…' })
      // Read source bytes in parallel, but write to the singleton serially.
      let done = 0
      await Promise.all(
        files.map(async (f, i) => {
          const bytes = await fetchFile(f.file)
          await withSingleton((mainFFmpeg) => mainFFmpeg.writeFile(encodedName(i), bytes))
          done++
          emit({
            status: 'encoding',
            percent: Math.min(80, 10 + Math.round((done / files.length) * 70)),
            label: `Copying chapters (already AAC)… (${done} of ${files.length} done)`,
          })
        }),
      )
    } else {
      emit({ status: 'encoding', percent: 10, label: 'Encoding chapters…' })
      await encodeFilesParallel(files, segments, bitrate, emit)
    }
    for (let i = 0; i < files.length; i++) {
      tempPaths.push(encodedName(i))
    }

    // 3. Concat list file
    emit({ status: 'concatenating', percent: 82, label: 'Joining chapters…' })
    const listBody = segments.map((_, i) => `file '${encodedName(i)}'`).join('\n') + '\n'
    await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
    tempPaths.push(LIST_PATH)

    // 4. Chapter metadata
    const chapters = buildChapters(segments.map((s) => ({ title: s.title, durationMs: s.durationMs })))
    const ffmetaBody = buildFFMetadata(chapters)
    const containerMeta =
      `;FFMETADATA1\n` +
      `title=${metadata.title}\n` +
      `artist=${metadata.author}\n` +
      `album=${metadata.title}\n` +
      `album_artist=${metadata.author}\n` +
      (metadata.narrator ? `composer=${metadata.narrator}\n` : '') +
      (metadata.year ? `date=${metadata.year}\n` : '') +
      `genre=${metadata.genre}\n`
    const ffmetaCombined = containerMeta + ffmetaBody.replace(/^;FFMETADATA1\n/, '')
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(ffmetaCombined))
    tempPaths.push(META_PATH)

    // 5. Cover art
    let hasCover = false
    if (coverFile) {
      emit({ status: 'muxing', percent: 86, label: 'Preparing cover art…' })
      const resized = await resizeCoverImage(coverFile)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      tempPaths.push(COVER_PATH)
      hasCover = true
    }

    // 6. Mux: concat audio + (cover) + chapter metadata → m4b
    emit({ status: 'muxing', percent: 90, label: 'Finalizing audiobook…' })

    const muxArgs: string[] = ['-hide_banner', '-f', 'concat', '-safe', '0', '-i', LIST_PATH]
    if (hasCover) muxArgs.push('-i', COVER_PATH)
    muxArgs.push('-i', META_PATH)

    muxArgs.push('-map', '0:a', '-map_metadata', String(hasCover ? 2 : 1))
    if (hasCover) {
      muxArgs.push('-map', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic')
    }
    muxArgs.push('-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', OUTPUT_PATH)

    // ffmpeg.wasm's 'progress' event rarely fires during stream-copy. Parse
    // 'time=HH:MM:SS.cc' from log lines instead — that fires for stream-copy
    // and gives us a real progress signal during the mux step (which is
    // otherwise invisible and reads like a hang for large audiobooks).
    const totalMuxDurationMs = segments.reduce((acc, s) => acc + s.durationMs, 0)
    const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

    const updateMuxProgress = (ratio: number) => {
      emit({
        status: 'muxing',
        percent: Math.min(99, 90 + Math.round(ratio * 9)),
        label: 'Finalizing audiobook…',
      })
    }

    const muxProgress = (p: { progress: number }) => {
      const local = Math.max(0, Math.min(1, p.progress))
      updateMuxProgress(local)
    }
    const muxLog = ({ message }: { message: string }) => {
      const m = message.match(TIME_RE)
      if (!m || totalMuxDurationMs <= 0) return
      const h = Number(m[1])
      const min = Number(m[2])
      const s = Number(m[3])
      const cs = Number(m[4].padEnd(2, '0'))
      const elapsedMs = ((h * 3600 + min * 60 + s) * 100 + cs) * 10
      const ratio = Math.max(0, Math.min(1, elapsedMs / totalMuxDurationMs))
      updateMuxProgress(ratio)
    }
    ffmpeg.on('progress', muxProgress)
    ffmpeg.on('log', muxLog)
    try {
      await ffmpeg.exec(muxArgs)
    } finally {
      ffmpeg.off('progress', muxProgress)
      ffmpeg.off('log', muxLog)
    }
    tempPaths.push(OUTPUT_PATH)

    const data = await ffmpeg.readFile(OUTPUT_PATH)
    const source = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    const bytes = new Uint8Array(source.byteLength)
    bytes.set(source)
    const blob = new Blob([bytes], { type: 'audio/mp4' })

    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    // Surface as much detail as possible — ffmpeg.wasm sometimes throws
    // numbers (POSIX codes), strings, or Errors with empty messages.
    console.error('mp3tom4b conversion failed:', err)
    let label = 'Conversion failed.'
    if (err instanceof Error && err.message) {
      label = err.message
    } else if (typeof err === 'string' && err) {
      label = err
    } else if (typeof err === 'number') {
      label = `ffmpeg error code ${err}`
    } else if (err != null) {
      const s = String(err)
      if (s && s !== '[object Object]') label = s
    }
    emit({ status: 'error', percent: 0, label })
    throw err
  } finally {
    for (const path of tempPaths) {
      await safeDelete(path)
    }
  }
}
