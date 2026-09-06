'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import type { Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { createWorkerFFmpeg, getFFmpeg, releaseWorkerFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'
import { buildEditMetadata, type EditChapter } from './editM4b'
import { buildMergeMuxArgs } from './mergeM4b'
import { resizeCoverImage } from '@/lib/image/resize'

const OUTPUT_PATH = 'chapterize_out.m4b'
const META_PATH = 'chapterize_meta.ffmeta'
const COVER_PATH = 'chapterize_cover.jpg'
const LIST_PATH = 'chapterize_list.txt'

// Cap on how long one physical segment can be. Bounds peak memory (the whole
// file is never re-encoded in one pass) regardless of how few chapters the user
// set — this is what stops long books from OOMing.
const MAX_SEG_MS = 20 * 60 * 1000

const segSrc = (i: number, ext: string) => `ch_seg_${String(i).padStart(3, '0')}.${ext}`
const encName = (i: number) => `ch_enc_${String(i).padStart(3, '0')}.m4a`

export type ChapterizeCoverMode = 'keep' | 'replace' | 'remove'

export interface Silence {
  startMs: number
  endMs: number
}

const SILENCE_START_RE = /silence_start:\s*(-?[\d.]+)/
const SILENCE_END_RE = /silence_end:\s*([\d.]+)/

/**
 * Parse ffmpeg's `silencedetect` log output into silence spans (ms). Pure +
 * unit-testable. `silence_start` and `silence_end` are emitted on separate
 * lines; a trailing unmatched start (silence running to EOF) is ignored.
 */
export function parseSilences(logLines: string[]): Silence[] {
  const silences: Silence[] = []
  let pendingStart: number | null = null
  for (const line of logLines) {
    const s = line.match(SILENCE_START_RE)
    if (s) {
      pendingStart = Math.max(0, Math.round(Number(s[1]) * 1000))
      continue
    }
    const e = line.match(SILENCE_END_RE)
    if (e && pendingStart != null) {
      silences.push({ startMs: pendingStart, endMs: Math.round(Number(e[1]) * 1000) })
      pendingStart = null
    }
  }
  return silences
}

/**
 * Turn detected silences into chapter start times (ms). A chapter begins at the
 * middle of each silence gap. Always starts at 0, and drops any break closer
 * than `minChapterMs` to the previous one so chapters aren't absurdly short.
 * Pure + unit-testable.
 */
export function proposeChaptersFromSilence(
  silences: Silence[],
  durationMs: number,
  opts: { minChapterMs?: number } = {},
): number[] {
  const minChapterMs = opts.minChapterMs ?? 60_000
  const starts: number[] = [0]
  for (const s of silences) {
    const mid = Math.round((s.startMs + s.endMs) / 2)
    if (mid <= 0 || (durationMs > 0 && mid >= durationMs)) continue
    if (mid - starts[starts.length - 1] >= minChapterMs) starts.push(mid)
  }
  return starts
}

/**
 * Split the timeline into equal chapters — either a fixed `count`, or one every
 * `intervalMs`. Always starts at 0; never emits a marker at/after the end.
 * Pure + unit-testable.
 */
export function proposeEqualChapters(
  durationMs: number,
  opts: { count?: number; intervalMs?: number },
): number[] {
  if (durationMs <= 0) return [0]
  if (opts.intervalMs && opts.intervalMs > 0) {
    const starts: number[] = []
    for (let t = 0; t < durationMs; t += opts.intervalMs) starts.push(Math.round(t))
    return starts.length ? starts : [0]
  }
  const count = Math.max(1, Math.floor(opts.count ?? 1))
  const step = durationMs / count
  return Array.from({ length: count }, (_, i) => Math.round(i * step))
}

/**
 * Physical segment boundaries (ms) for the re-encode: the user's chapter starts,
 * plus extra splits so no segment is longer than `maxSegMs`. Always begins at 0.
 * Keeping segments small bounds memory even when the user set very few chapters.
 * Pure + unit-testable.
 */
export function buildSegmentBoundaries(
  userStartsMs: number[],
  durationMs: number,
  maxSegMs: number = MAX_SEG_MS,
): number[] {
  const clean = Array.from(
    new Set(userStartsMs.filter((t) => t >= 0 && (durationMs <= 0 || t < durationMs))),
  ).sort((a, b) => a - b)
  if (clean[0] !== 0) clean.unshift(0)
  if (durationMs <= 0 || maxSegMs <= 0) return clean

  const out: number[] = []
  for (let i = 0; i < clean.length; i++) {
    out.push(clean[i])
    const next = i + 1 < clean.length ? clean[i + 1] : durationMs
    let t = clean[i]
    while (next - t > maxSegMs) {
      t += maxSegMs
      out.push(t)
    }
  }
  return out
}

/** Segment split points (seconds, comma-joined) for `-segment_times`. Pure. */
export function buildSegmentTimes(boundariesMs: number[]): string {
  return boundariesMs
    .slice(1)
    .map((ms) => (ms / 1000).toFixed(3))
    .join(',')
}

/**
 * ffmpeg args to re-encode a single input to AAC and mux it into an M4B with our
 * chapter markers (and optional cover). Used for the SERIAL fallback (short
 * files). `coverPath` null means no cover. Pure.
 */
export function buildChapterizeArgs(o: {
  input: string
  coverPath: string | null
  metaPath: string
  bitrate: Bitrate
  output: string
}): string[] {
  const args = ['-hide_banner', '-i', o.input]
  if (o.coverPath) args.push('-i', o.coverPath)
  args.push('-i', o.metaPath)
  const metaIdx = o.coverPath ? 2 : 1
  args.push('-map', '0:a')
  if (o.coverPath) args.push('-map', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic')
  args.push(
    '-map_metadata', String(metaIdx),
    '-map_chapters', String(metaIdx),
    '-c:a', 'aac',
    '-b:a', `${o.bitrate}k`,
    '-metadata', 'media_type=2',
    '-metadata:s:a', 'pgap=1',
    '-movflags', '+faststart',
    '-f', 'mp4',
    o.output,
  )
  return args
}

/** ffmpeg args to re-encode one already-split segment to AAC. Pure. */
export function buildSegmentEncodeArgs(o: { input: string; output: string; bitrate: Bitrate }): string[] {
  return ['-hide_banner', '-i', o.input, '-vn', '-c:a', 'aac', '-b:a', `${o.bitrate}k`, o.output]
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

/** Container extension to hold copied segments of the given input (M4B→m4a). */
function segmentExtension(inputExt: string): string {
  return inputExt === 'm4b' ? 'm4a' : inputExt
}

function toBytes(data: unknown): Uint8Array<ArrayBuffer> {
  const u = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
  const b = new Uint8Array(u.byteLength)
  b.set(u)
  return b
}

const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

function elapsedMsFromLog(message: string): number | null {
  const m = message.match(TIME_RE)
  if (!m) return null
  return ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
}

/** How many segments to encode in parallel — scales with CPU, capped at 3. */
function encodeConcurrency(count: number): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  return Math.min(3, count, Math.max(1, Math.floor(cores / 2)))
}

// Serialize writes to the singleton FS from the parallel workers. Concurrent
// writes into one ffmpeg.wasm instance corrupt its heap.
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

/**
 * Re-encode already-split segments to AAC across a pool of worker instances.
 * Each worker reads a segment from the singleton FS, encodes it, and writes the
 * result back. Occupies the visible 10–85 progress range.
 */
async function encodeSegmentsParallel(
  count: number,
  segExt: string,
  bitrate: Bitrate,
  emit: (p: ConversionProgress) => void,
): Promise<void> {
  const perSeg = new Array<number>(count).fill(0)
  let completed = 0
  const emitProgress = () => {
    const sum = perSeg.reduce((a, b) => a + b, 0)
    emit({
      status: 'encoding',
      percent: Math.min(85, 10 + Math.round((sum / count) * 75)),
      label: `Encoding chapters… (${completed} of ${count} done)`,
    })
  }

  const queue = Array.from({ length: count }, (_, i) => i)

  async function runWorker() {
    const worker = await createWorkerFFmpeg()
    try {
      while (true) {
        const idx = queue.shift()
        if (idx === undefined) break

        const workerIn = `w_in_${idx}.${segExt}`
        const workerOut = `w_out_${idx}.m4a`
        const onProg = ({ progress }: { progress: number }) => {
          perSeg[idx] = Math.max(0, Math.min(1, progress))
          emitProgress()
        }
        worker.on('progress', onProg)
        try {
          const src = await withSingleton(async (m) => toBytes(await m.readFile(segSrc(idx, segExt))))
          await worker.writeFile(workerIn, src)
          await worker.exec(buildSegmentEncodeArgs({ input: workerIn, output: workerOut, bitrate }))
          const enc = toBytes(await worker.readFile(workerOut))
          await withSingleton((m) => m.writeFile(encName(idx), enc))
        } finally {
          worker.off('progress', onProg)
          perSeg[idx] = 1
          completed++
          emitProgress()
          try { await worker.deleteFile(workerIn) } catch { /* ignore */ }
          try { await worker.deleteFile(workerOut) } catch { /* ignore */ }
          try { await withSingleton((m) => m.deleteFile(segSrc(idx, segExt))) } catch { /* ignore */ }
        }
      }
    } finally {
      releaseWorkerFFmpeg(worker)
    }
  }

  const concurrency = encodeConcurrency(count)
  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
}

/**
 * Run ffmpeg's silencedetect over a file and return proposed chapter start times
 * (ms). This is a full decode pass, so it can be slow on long files — the caller
 * shows progress + holds a wake lock. Runs entirely in-browser.
 */
export async function detectSilenceChapters(
  file: File,
  opts: { minGapMs?: number; minChapterMs?: number; durationMs?: number },
  onProgress?: (p: ConversionProgress) => void,
): Promise<number[]> {
  const emit = (p: ConversionProgress) => onProgress?.(p)
  const minGapSec = Math.max(0.1, (opts.minGapMs ?? 1500) / 1000)
  const durationMs = opts.durationMs ?? 0

  emit({ status: 'probing', percent: 2, label: 'Loading converter…' })
  const ffmpeg = await getFFmpeg()

  const inputPath = `silence_in.${fileExtension(file.name)}`
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => {
    lines.push(message)
    if (durationMs > 0) {
      const elapsed = elapsedMsFromLog(message)
      if (elapsed != null) {
        emit({
          status: 'probing',
          percent: Math.min(99, 5 + Math.round(Math.max(0, Math.min(1, elapsed / durationMs)) * 94)),
          label: 'Scanning for silence…',
        })
      }
    }
  }

  try {
    emit({ status: 'probing', percent: 4, label: 'Scanning for silence…' })
    await ffmpeg.writeFile(inputPath, await fetchFile(file))
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(['-hide_banner', '-i', inputPath, '-af', `silencedetect=noise=-30dB:d=${minGapSec}`, '-f', 'null', '-'])
    } catch {
      // silencedetect always exits after the decode pass; we only need the log
    } finally {
      ffmpeg.off('log', onLog)
    }
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return proposeChaptersFromSilence(parseSilences(lines), durationMs, { minChapterMs: opts.minChapterMs })
  } finally {
    try {
      await ffmpeg.deleteFile(inputPath)
    } catch {
      // ignore
    }
  }
}

export interface ChapterizeOptions {
  file: File
  chapters: EditChapter[]
  metadata: ConversionMetadata
  cover: { mode: ChapterizeCoverMode; file?: File | null }
  bitrate: Bitrate
  durationMs: number
  onProgress?: (p: ConversionProgress) => void
}

/**
 * Turn a single audio file into a chaptered M4B: the file is split into
 * chapter-sized pieces, each re-encoded to AAC in parallel (so long books don't
 * exhaust memory), then concatenated and muxed with the given chapter markers,
 * metadata, and cover. Short files use a single serial re-encode. All in-browser.
 */
export async function chapterizeFile(opts: ChapterizeOptions): Promise<Blob> {
  const { file, chapters, metadata, cover, bitrate, durationMs, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: 'Loading converter…' })
  const ffmpeg = await getFFmpeg()

  const inputExt = fileExtension(file.name)
  const segExt = segmentExtension(inputExt)
  const inputPath = `chapterize_in.${inputExt}`
  const tempPaths: string[] = []

  try {
    emit({ status: 'encoding', percent: 4, label: 'Reading file…' })
    await ffmpeg.writeFile(inputPath, await fetchFile(file))
    tempPaths.push(inputPath)

    // Cover (resized JPEG) — both "keep" and "replace" supply a File.
    let coverPath: string | null = null
    if (cover.mode !== 'remove' && cover.file) {
      const resized = await resizeCoverImage(cover.file)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      coverPath = COVER_PATH
      tempPaths.push(COVER_PATH)
    }

    // Our chapter markers (independent of where the audio is physically split).
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(buildEditMetadata(metadata, chapters, durationMs)))
    tempPaths.push(META_PATH)

    const boundaries = buildSegmentBoundaries(chapters.map((c) => c.startMs), durationMs)
    const segCount = boundaries.length
    const useParallel = segCount >= 2 && encodeConcurrency(segCount) >= 1 && durationMs > 0

    if (useParallel) {
      // 1. Split the input into pieces by stream copy (fast, low memory).
      emit({ status: 'encoding', percent: 6, label: 'Splitting into chapters…' })
      await ffmpeg.exec([
        '-hide_banner', '-i', inputPath, '-map', '0:a', '-c:a', 'copy',
        '-f', 'segment', '-segment_times', buildSegmentTimes(boundaries),
        '-reset_timestamps', '1', `ch_seg_%03d.${segExt}`,
      ])
      for (let i = 0; i < segCount; i++) tempPaths.push(segSrc(i, segExt), encName(i))

      // 2. Free the big input before the memory-heavy encode stage.
      try { await ffmpeg.deleteFile(inputPath) } catch { /* ignore */ }

      // 3. Re-encode each piece to AAC across workers.
      await encodeSegmentsParallel(segCount, segExt, bitrate, emit)

      // 4. Concat the pieces + attach our chapters/cover.
      const listBody = boundaries.map((_, i) => `file '${encName(i)}'`).join('\n') + '\n'
      await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
      tempPaths.push(LIST_PATH)

      emit({ status: 'muxing', percent: 88, label: 'Finalizing audiobook…' })
      await ffmpeg.exec(buildMergeMuxArgs({ listPath: LIST_PATH, coverPath, metaPath: META_PATH, output: OUTPUT_PATH }))
      tempPaths.push(OUTPUT_PATH)

      const blob = new Blob([toBytes(await ffmpeg.readFile(OUTPUT_PATH))], { type: 'audio/mp4' })
      emit({ status: 'done', percent: 100, label: 'Done.' })
      return blob
    }

    // ---- Serial fallback (short file / single segment): one re-encode exec ----
    emit({ status: 'encoding', percent: 10, label: 'Encoding audiobook…' })
    const pct = (ratio: number) => Math.min(99, 10 + Math.round(Math.max(0, Math.min(1, ratio)) * 89))
    const onProg = ({ progress }: { progress: number }) => {
      emit({ status: 'encoding', percent: pct(progress), label: 'Encoding audiobook…' })
    }
    const onLog = ({ message }: { message: string }) => {
      if (durationMs <= 0) return
      const elapsed = elapsedMsFromLog(message)
      if (elapsed != null) emit({ status: 'encoding', percent: pct(elapsed / durationMs), label: 'Encoding audiobook…' })
    }
    ffmpeg.on('progress', onProg)
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(buildChapterizeArgs({ input: inputPath, coverPath, metaPath: META_PATH, bitrate, output: OUTPUT_PATH }))
    } finally {
      ffmpeg.off('progress', onProg)
      ffmpeg.off('log', onLog)
    }
    tempPaths.push(OUTPUT_PATH)

    const blob = new Blob([toBytes(await ffmpeg.readFile(OUTPUT_PATH))], { type: 'audio/mp4' })
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    console.error('mp3tom4b chapterize failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    for (const path of tempPaths) {
      try {
        await ffmpeg.deleteFile(path)
      } catch {
        // instance may have been terminated (cancel) — ignore
      }
    }
  }
}
