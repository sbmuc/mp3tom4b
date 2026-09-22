'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { AudioFile, Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { resizeCoverImage } from '@/lib/image/resize'
import { buildChapters, buildFFMetadata, buildGlobalMetadata } from './chapters'
import { createWorkerFFmpeg, ffmpegLoadingLabel, getFFmpeg, releaseWorkerFFmpeg } from './client'
import {
  audioStreamSignature,
  buildEncodeArgs,
  buildTimedConcatList,
  canCopyStreams,
  mayStreamCopy,
  pickEncodeTarget,
  type EncodeTarget,
} from './concatPlan'
import { humanizeFfmpegError } from './errors'
import { decodedAudioSeconds } from './mp4Duration'
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
 * Every part is encoded to the same sample rate + channel count, so the parts
 * can be copy-joined. Encoded outputs are written to the main singleton's
 * virtual FS so that the concat step can read them normally. Returns each
 * part's decoded length in seconds (null if it couldn't be read).
 */
async function encodeFilesParallel(
  files: AudioFile[],
  segments: Array<{ ext: string }>,
  bitrate: Bitrate,
  target: EncodeTarget,
  emit: (p: ConversionProgress) => void,
): Promise<Array<number | null>> {
  const total = files.length
  const decodedSec = new Array<number | null>(total).fill(null)
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
            worker.exec(buildEncodeArgs({ input: inPath, output: outPath, bitrate, target })),
          )
          const bytes = await tagged('reading encoded output of', async () => {
            const data = await worker.readFile(outPath)
            const src = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
            const buf = new Uint8Array(src.byteLength)
            buf.set(src)
            return buf
          })
          // Measure before the write: writeFile transfers (detaches) the buffer.
          decodedSec[idx] = decodedAudioSeconds(bytes)
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
  return decodedSec
}

/** ffmpeg's one-line description of a file's audio stream (see concatPlan). */
async function probeStreamSignature(ffmpeg: FFmpeg, path: string): Promise<string | null> {
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', onLog)
  try {
    // No output file → ffmpeg exits non-zero after printing the header, which
    // is all we need. `-v info` explicitly: the log level persists across runs
    // on one instance, and the stream line is only printed at info.
    await ffmpeg.exec(['-hide_banner', '-v', 'info', '-i', path])
  } catch {
    // expected
  } finally {
    ffmpeg.off('log', onLog)
  }
  return audioStreamSignature(lines)
}

/**
 * Skip the re-encode for AAC .m4a inputs: write each source straight to the
 * singleton FS as its enc_N.m4a part and probe it. Copy-joining is only safe
 * when every part has the exact same codec config, so on any mismatch the
 * parts are removed again and null tells the caller to re-encode. Otherwise
 * returns each part's decoded length in seconds.
 */
async function copyIfCompatible(
  files: AudioFile[],
  emit: (p: ConversionProgress) => void,
): Promise<Array<number | null> | null> {
  const decodedSec = new Array<number | null>(files.length).fill(null)
  const signatures = new Array<string | null>(files.length).fill(null)
  // Read source bytes in parallel, but write to (and probe on) the singleton serially.
  let done = 0
  await Promise.all(
    files.map(async (f, i) => {
      const bytes = await fetchFile(f.file)
      decodedSec[i] = decodedAudioSeconds(bytes) // before the write detaches the buffer
      signatures[i] = await withSingleton(async (mainFFmpeg) => {
        await mainFFmpeg.writeFile(encodedName(i), bytes)
        return probeStreamSignature(mainFFmpeg, encodedName(i))
      })
      done++
      emit({
        status: 'encoding',
        percent: Math.min(80, 10 + Math.round((done / files.length) * 70)),
        label: `Copying chapters (already AAC)… (${done} of ${files.length} done)`,
      })
    }),
  )
  if (canCopyStreams(signatures)) return decodedSec
  for (let i = 0; i < files.length; i++) await safeDelete(encodedName(i))
  return null
}

/**
 * Convert a list of audio files into a single chaptered M4B audiobook.
 * All processing happens in-browser via ffmpeg.wasm.
 */
export async function convertToM4B(opts: ConvertOptions): Promise<Blob> {
  const { files, metadata, coverFile, bitrate, onProgress } = opts
  if (files.length === 0) throw new Error('No input files provided.')

  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
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
    // AAC .m4a inputs already at the chosen bitrate are copied as-is when they
    // share one codec config (no CPU cost, no quality loss); everything else
    // goes through the parallel AAC encoding workers at one common target.
    let decodedSec: Array<number | null> | null = null
    if (mayStreamCopy(files, bitrate)) {
      emit({ status: 'encoding', percent: 10, label: 'Copying chapters (already AAC)…' })
      decodedSec = await copyIfCompatible(files, emit)
    }
    if (!decodedSec) {
      emit({ status: 'encoding', percent: 10, label: 'Encoding chapters…' })
      decodedSec = await encodeFilesParallel(files, segments, bitrate, pickEncodeTarget(files), emit)
    }
    for (let i = 0; i < files.length; i++) {
      tempPaths.push(encodedName(i))
    }

    // 3. Concat list file, with each part's real decoded length so the joined
    // timeline (and the chapter markers below) line up with the audio.
    emit({ status: 'concatenating', percent: 82, label: 'Joining chapters…' })
    const listBody = buildTimedConcatList(
      segments.map((_, i) => ({ name: encodedName(i), durationSec: decodedSec[i] })),
    )
    await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
    tempPaths.push(LIST_PATH)

    // 4. Chapter metadata — boundaries from the encoded parts' decoded lengths
    // (source durations are ~20–45 ms short per part, which adds up).
    const chapters = buildChapters(
      segments.map((s, i) => {
        const sec = decodedSec[i]
        return { title: s.title, durationMs: sec != null ? sec * 1000 : s.durationMs }
      }),
    )
    const ffmetaBody = buildFFMetadata(chapters)
    const containerMeta = [';FFMETADATA1', ...buildGlobalMetadata(metadata)].join('\n') + '\n'
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
    // stik=2 marks the file as an Audiobook so players file it correctly and
    // remember the resume position; pgap enables gapless playback.
    muxArgs.push('-metadata', 'media_type=2', '-metadata:s:a', 'pgap=1')
    muxArgs.push('-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', OUTPUT_PATH)

    // ffmpeg.wasm's 'progress' event rarely fires during stream-copy. Parse
    // 'time=HH:MM:SS.cc' from log lines instead — that fires for stream-copy
    // and gives us a real progress signal during the mux step (which is
    // otherwise invisible and reads like a hang for large audiobooks).
    const totalMuxDurationMs = chapters.length ? chapters[chapters.length - 1].endMs : 0
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
    console.error('mp3tom4b conversion failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    for (const path of tempPaths) {
      await safeDelete(path)
    }
  }
}
