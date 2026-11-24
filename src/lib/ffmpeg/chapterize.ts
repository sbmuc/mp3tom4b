'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { loadEngine } from './engine'
import {
  ANY_AUDIO_SEGMENT_EXT,
  allKnown,
  buildTimedConcatList,
  copySegmentExtension,
  parseSegmentList,
  remapThroughSegments,
} from './concatPlan'
import { OWN_COVER_ARGS } from './cover'
import { humanizeFfmpegError, noteFailureStep, type FailureStep } from './errors'
import { buildEditMetadata, readOtherTags, type EditChapter } from './editM4b'
import { mountBlobs, ownedBytes, takeBlob, unmount } from './files'
import { parseM4bProbe } from './probeM4b'
import { buildMergeMuxArgs } from './mergeM4b'
import { encodeConcurrency, encodeSegmentsInWorkers } from './segments'
import { oneAtATime } from './serial'
import { resizeCoverImage } from '@/lib/image/resize'
import { FFmpegExitError, runFFmpeg } from './run'

const OUTPUT_PATH = 'chapterize_out.m4b'
const META_PATH = 'chapterize_meta.ffmeta'
const COVER_PATH = 'chapterize_cover.jpg'
const LIST_PATH = 'chapterize_list.txt'
const SEG_LIST_PATH = 'chapterize_segments.csv'
// The source and the re-encoded pieces are mounted, not copied in (see files.ts).
const INPUT_DIR = '/mnt_chapterize_in'
const PARTS_DIR = '/mnt_chapterize_parts'
const SILENCE_DIR = '/mnt_silence'

// Cap on how long one physical segment can be. Bounds peak memory (the whole
// file is never re-encoded in one pass) regardless of how few chapters the user
// set — this is what stops long books from OOMing.
const MAX_SEG_MS = 20 * 60 * 1000

/** Inputs that are books already, whose own tags carry over (see chapterizeFile). */
const MP4_FAMILY = new Set(['m4b', 'm4a', 'mp4'])

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

/** What a silence scan found: the chapters it proposes and how many pauses it saw. */
export interface SilenceChapters {
  /** Chapter start times (ms), always starting at 0. */
  starts: number[]
  /** Pauses inside the file, including those too close to the previous chapter to use. */
  pauses: number
}

const durationLabel = (ms: number) =>
  ms % 60_000 === 0 ? `${ms / 60_000} min` : `${Math.round(ms / 1000)} s`

/**
 * One line telling the user what a silence scan did, so a scan that yields no
 * chapters never looks like nothing happened. Pure + unit-testable.
 */
export function describeSilenceResult(
  r: SilenceChapters,
  opts: { minGapSec: number; minChapterMs: number },
): string {
  const gap = `${opts.minGapSec} s`
  const shortest = durationLabel(opts.minChapterMs)
  const pauses = `${r.pauses} pause${r.pauses === 1 ? '' : 's'}`
  if (r.pauses === 0) return `No pauses of ${gap} or longer found. Try a shorter pause.`
  const used = r.starts.length - 1
  if (used === 0) {
    return `Found ${pauses} of ${gap} or longer, but none comes at least ${shortest} after the start or the previous chapter. Lower the shortest chapter and detect again.`
  }
  const skipped = r.pauses - used
  const made = `Found ${pauses} of ${gap} or longer and made ${r.starts.length} chapters`
  return skipped > 0
    ? `${made}. ${skipped} pause${skipped === 1 ? ' was' : 's were'} skipped because ${skipped === 1 ? 'it came' : 'they came'} less than ${shortest} after the previous chapter.`
    : `${made}.`
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
 * How long each chapter in the list runs: from its start to the next later
 * start, or to the end of the file. The list needn't be in order (it is
 * sorted only when a time loses focus). Null for a time that isn't one, one
 * at or past the end, one that appears twice (the list marks those), or a
 * last chapter when the file's length is unknown. Pure + unit-testable.
 */
export function chapterLengthsMs(starts: Array<number | null>, durationMs: number): Array<number | null> {
  const usable = (s: number | null): s is number => s != null && s >= 0 && (durationMs <= 0 || s < durationMs)
  const counts = new Map<number, number>()
  for (const s of starts) if (usable(s)) counts.set(s, (counts.get(s) ?? 0) + 1)
  const sorted = [...counts.keys()].sort((a, b) => a - b)
  return starts.map((s) => {
    if (!usable(s) || counts.get(s)! > 1) return null
    const next = sorted[sorted.indexOf(s) + 1]
    if (next != null) return next - s
    return durationMs > 0 ? durationMs - s : null
  })
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
  // The cover is always one we made (resizeCoverImage): copied in as it is.
  if (o.coverPath) args.push('-map', '1', ...OWN_COVER_ARGS, '-disposition:v', 'attached_pic')
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

const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

function elapsedMsFromLog(message: string): number | null {
  const m = message.match(TIME_RE)
  if (!m) return null
  return ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
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
): Promise<SilenceChapters> {
  const emit = (p: ConversionProgress) => onProgress?.(p)
  const minGapSec = Math.max(0.1, (opts.minGapMs ?? 1500) / 1000)
  const durationMs = opts.durationMs ?? 0

  emit({ status: 'probing', percent: 2, label: ffmpegLoadingLabel() })
  // It reads the log, so it takes its turn with the other probes (serial.ts).
  let lines: string[]
  try {
    lines = await oneAtATime(() => scanForSilence(file, minGapSec, durationMs, emit))
  } catch (err) {
    // Without this a failed scan (a mount error) left the bar where it was.
    console.error('mp3tom4b silence scan failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  }
  emit({ status: 'done', percent: 100, label: 'Done.' })
  const silences = parseSilences(lines)
  const inside = silences.filter((s) => {
    const mid = (s.startMs + s.endMs) / 2
    return mid > 0 && (durationMs <= 0 || mid < durationMs)
  })
  return {
    starts: proposeChaptersFromSilence(silences, durationMs, { minChapterMs: opts.minChapterMs }),
    pauses: inside.length,
  }
}

/** One silencedetect decode pass; returns the log lines it printed. */
async function scanForSilence(
  file: File,
  minGapSec: number,
  durationMs: number,
  emit: (p: ConversionProgress) => void,
): Promise<string[]> {
  const ffmpeg = await getFFmpeg()

  const inputName = `silence_in.${fileExtension(file.name)}`
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
    await mountBlobs(ffmpeg, SILENCE_DIR, [{ name: inputName, data: file }])
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(['-hide_banner', '-i', `${SILENCE_DIR}/${inputName}`, '-af', `silencedetect=noise=-30dB:d=${minGapSec}`, '-f', 'null', '-'])
    } catch {
      // silencedetect always exits after the decode pass; we only need the log
    } finally {
      ffmpeg.off('log', onLog)
    }
    return lines
  } finally {
    await unmount(ffmpeg, SILENCE_DIR)
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
 * What the user reads when not even ffmpeg can tell how long the file is: the
 * last chapter would have no end, and ffmpeg refuses that.
 */
export const UNKNOWN_LENGTH =
  "Couldn't tell how long this file is, so the chapters can't be placed. The file may be damaged."

/**
 * The chapters that start inside a file of `durationMs`, in order; the first
 * always stays. A chapter past the end has no audio, and as the last one it
 * would end before it starts, which ffmpeg refuses. Pure + unit-testable.
 */
export function chaptersWithin(chapters: EditChapter[], durationMs: number): EditChapter[] {
  return [...chapters].sort((a, b) => a.startMs - b.startMs).filter((c, i) => i === 0 || c.startMs < durationMs)
}

/** The file's length as ffmpeg reads it from the header, in ms, or null. */
async function headerDurationMs(ffmpeg: FFmpeg, path: string): Promise<number | null> {
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', onLog)
  try {
    // No output file: ffmpeg exits non-zero after printing the header, which
    // is all we need. `-v info`: the level persists across runs on one instance.
    await ffmpeg.exec(['-hide_banner', '-v', 'info', '-i', path])
  } catch {
    // expected
  } finally {
    ffmpeg.off('log', onLog)
  }
  const ms = parseM4bProbe(lines).durationMs
  return ms != null && ms > 0 ? ms : null
}

async function deleteQuietly(ffmpeg: FFmpeg, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path)
  } catch {
    // never written
  }
}

/**
 * Turn a single audio file into a chaptered M4B: the file is split into
 * chapter-sized pieces, each re-encoded to AAC in parallel (so long books don't
 * exhaust memory), then concatenated and muxed with the given chapter markers,
 * metadata, and cover. Short files use a single serial re-encode. All in-browser.
 */
export async function chapterizeFile(opts: ChapterizeOptions): Promise<Blob> {
  const { file, metadata, cover, bitrate, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await loadEngine(emit, 'chapterize')

  const inputExt = fileExtension(file.name)
  const inputName = `in.${inputExt}`
  const inputPath = `${INPUT_DIR}/${inputName}`
  const tempPaths: string[] = []
  // Where it was if it fails, for the failure count (see noteFailureStep).
  let step: FailureStep = 'reading'

  try {
    emit({ status: 'encoding', percent: 4, label: 'Reading file…' })
    await mountBlobs(ffmpeg, INPUT_DIR, [{ name: inputName, data: file }])

    // The page reads the length from the tags or the browser's player; when
    // neither could, ffmpeg still can. Without one the last chapter ended at
    // 0, which ffmpeg refused as "Cannot allocate memory": a memory error to
    // the user, for a file that was fine.
    let durationMs = opts.durationMs > 0 ? opts.durationMs : ((await headerDurationMs(ffmpeg, inputPath)) ?? 0)
    if (durationMs <= 0) throw new Error(UNKNOWN_LENGTH)
    let chapters = chaptersWithin(opts.chapters, durationMs)
    // An M4B (or M4A, MP4) gets its chapters redone but stays the same book:
    // the tags the form has no field for (track, comment, copyright, …) are
    // kept, as the editor keeps them. Other files' tags (an MP3's track number
    // of a CD set, say) don't describe the book, so they stay behind.
    const otherTags = MP4_FAMILY.has(inputExt) ? await readOtherTags(ffmpeg, inputPath) : []

    // Cover (resized JPEG) — both "keep" and "replace" supply a File.
    step = 'cover'
    let coverPath: string | null = null
    if (cover.mode !== 'remove' && cover.file) {
      const resized = await resizeCoverImage(cover.file)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      coverPath = COVER_PATH
      tempPaths.push(COVER_PATH)
    }

    // Our chapter markers (independent of where the audio is physically split).
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(buildEditMetadata(metadata, chapters, durationMs, otherTags)))
    tempPaths.push(META_PATH)

    let boundaries = buildSegmentBoundaries(chapters.map((c) => c.startMs), durationMs)
    const useParallel = boundaries.length >= 2 && encodeConcurrency(boundaries.length) >= 1

    if (useParallel) {
      // 1. Split the input into pieces by stream copy (fast, low memory).
      step = 'splitting'
      emit({ status: 'encoding', percent: 6, label: 'Splitting into chapters…' })
      const splitArgs = (ext: string) => [
        '-hide_banner', '-i', inputPath, '-map', '0:a', '-c:a', 'copy',
        '-f', 'segment', '-segment_times', buildSegmentTimes(boundaries),
        '-segment_list', SEG_LIST_PATH, '-segment_list_type', 'csv',
        '-reset_timestamps', '1', `ch_seg_%03d.${ext}`,
      ]
      tempPaths.push(SEG_LIST_PATH)
      let segExt = copySegmentExtension(inputExt)
      try {
        await runFFmpeg(ffmpeg, splitArgs(segExt))
      } catch (err) {
        // The muxer the name picks refused what is inside (an AAC, FLAC or WAV
        // file named .mp3 failed at once with "ffmpeg exited with code 1"):
        // split into Matroska instead, which takes any audio as it is.
        if (!(err instanceof FFmpegExitError && err.kind === 'unknown') || segExt === ANY_AUDIO_SEGMENT_EXT) throw err
        for (let i = 0; i < boundaries.length; i++) await deleteQuietly(ffmpeg, segSrc(i, segExt))
        segExt = ANY_AUDIO_SEGMENT_EXT
        await runFFmpeg(ffmpeg, splitArgs(segExt))
      }

      // The pieces it really made, and where each really starts (a copy split
      // cuts on a packet, up to one frame from the time asked for). A file that
      // ends sooner than the page thought (a length from the tags can be an
      // estimate) has no pieces for the times past its end, and the chapters
      // there have no audio: they are dropped instead of failing the run.
      let list: Array<{ startMs: number; endMs: number }> | null = null
      try {
        list = parseSegmentList(new TextDecoder().decode(ownedBytes(await ffmpeg.readFile(SEG_LIST_PATH))))
      } catch {
        list = null
      }
      if (list && list.length < boundaries.length) {
        boundaries = boundaries.slice(0, list.length)
        durationMs = list[list.length - 1].endMs
        chapters = chaptersWithin(chapters, durationMs)
      }
      const segCount = boundaries.length
      for (let i = 0; i < segCount; i++) tempPaths.push(segSrc(i, segExt))
      const segStarts = list && list.length === segCount ? list.map((r) => r.startMs) : null

      // 2. Hand the pieces to the browser as Blobs, so none stays in this
      // page's memory while the workers encode them.
      const segments: Blob[] = []
      for (let i = 0; i < segCount; i++) segments.push(await takeBlob(ffmpeg, segSrc(i, segExt)))
      await unmount(ffmpeg, INPUT_DIR)

      // 3. Re-encode each piece to AAC across workers.
      step = 'encoding'
      const { parts, decodedSec } = await encodeSegmentsInWorkers(segments, {
        ext: segExt,
        args: (input, output) => buildSegmentEncodeArgs({ input, output, bitrate }),
        onProgress: (fraction, done) =>
          emit({
            status: 'encoding',
            percent: Math.min(85, 10 + Math.round(fraction * 75)),
            label: `Encoding chapters… (${done} of ${segCount} done)`,
          }),
      })
      step = 'joining'
      await mountBlobs(ffmpeg, PARTS_DIR, parts.map((data, i) => ({ name: encName(i), data })))

      // 4. Concat the pieces with their real decoded lengths + attach our
      // chapters/cover. Re-encoding makes each piece slightly longer, so the
      // markers are moved through the pieces to stay on the audio.
      const listBody = buildTimedConcatList(
        boundaries.map((_, i) => ({ name: `${PARTS_DIR}/${encName(i)}`, durationSec: decodedSec[i] })),
      )
      await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
      tempPaths.push(LIST_PATH)
      const known = allKnown(decodedSec)
      const moved = known
        ? chapters.map((c) => ({ ...c, startMs: remapThroughSegments(c.startMs, segStarts ?? boundaries, known) }))
        : chapters
      const totalMs = known ? known.reduce((a, s) => a + s * 1000, 0) : durationMs
      await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(buildEditMetadata(metadata, moved, totalMs, otherTags)))

      emit({ status: 'muxing', percent: 88, label: 'Finalizing audiobook…' })
      tempPaths.push(OUTPUT_PATH)
      await runFFmpeg(ffmpeg, buildMergeMuxArgs({ listPath: LIST_PATH, coverPath, metaPath: META_PATH, output: OUTPUT_PATH, ownCover: true }))
      await unmount(ffmpeg, PARTS_DIR)

      step = 'reading_output'
      const blob = await takeBlob(ffmpeg, OUTPUT_PATH)
      emit({ status: 'done', percent: 100, label: 'Done.' })
      return blob
    }

    // ---- Serial fallback (short file / single segment): one re-encode exec ----
    step = 'encoding'
    emit({ status: 'encoding', percent: 10, label: 'Encoding audiobook…' })
    const pct = (ratio: number) => Math.min(99, 10 + Math.round(Math.max(0, Math.min(1, ratio)) * 89))
    const onProg = ({ progress }: { progress: number }) => {
      emit({ status: 'encoding', percent: pct(progress), label: 'Encoding audiobook…' })
    }
    const onLog = ({ message }: { message: string }) => {
      const elapsed = elapsedMsFromLog(message)
      if (elapsed != null) emit({ status: 'encoding', percent: pct(elapsed / durationMs), label: 'Encoding audiobook…' })
    }
    tempPaths.push(OUTPUT_PATH)
    ffmpeg.on('progress', onProg)
    ffmpeg.on('log', onLog)
    try {
      await runFFmpeg(ffmpeg, buildChapterizeArgs({ input: inputPath, coverPath, metaPath: META_PATH, bitrate, output: OUTPUT_PATH }))
    } finally {
      ffmpeg.off('progress', onProg)
      ffmpeg.off('log', onLog)
    }
    await unmount(ffmpeg, INPUT_DIR)

    step = 'reading_output'
    const blob = await takeBlob(ffmpeg, OUTPUT_PATH)
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    noteFailureStep(err, step)
    console.error('mp3tom4b chapterize failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    await unmount(ffmpeg, INPUT_DIR)
    await unmount(ffmpeg, PARTS_DIR)
    for (const path of tempPaths) {
      try {
        await ffmpeg.deleteFile(path)
      } catch {
        // already taken, or the instance was terminated (cancel) — ignore
      }
    }
  }
}
