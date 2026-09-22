'use client'

import { fetchFile } from '@ffmpeg/util'
import type { Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'
import { buildFFMetadata, buildGlobalMetadata } from './chapters'
import type { ChapterMark } from './types'
import type { Chapter } from './splitChapters'
import type { AudioStreamInfo } from './probeM4b'
import { resizeCoverImage } from '@/lib/image/resize'

const OUTPUT_PATH = 'merge_out.m4b'
const META_PATH = 'merge_meta.ffmeta'
const COVER_PATH = 'merge_cover.jpg'
const LIST_PATH = 'merge_list.txt'
const partName = (i: number) => `merge_part_${String(i).padStart(3, '0')}.m4a`

export type MergeChapterMode = 'keep' | 'perFile'
export type MergeCoverMode = 'keep' | 'replace' | 'remove'

/** One input file's timeline, used to build the merged chapter list. */
export interface MergePart {
  chapters: Chapter[]
  durationMs: number
  /** Fallback title for a chapterless part / the "one chapter per file" mode. */
  title: string
}

export interface ReencodeTarget {
  sampleRate: number
  /** 1 (mono) or 2 (stereo). */
  channels: number
}

export interface Compatibility {
  /** True when every input shares the same AAC codec/sample rate/channels, so
   *  the parts can be stream-copied instead of re-encoded. */
  canCopy: boolean
  /** The common AAC target used when re-encoding is required. */
  target: ReencodeTarget
}

/**
 * Decide whether the inputs can be concatenated with `-c copy` (fast, lossless)
 * or must be re-encoded to a common AAC target. Copy is only safe when every
 * stream is AAC with identical sample rate and channel layout. Pure.
 */
export function analyzeCompatibility(streams: AudioStreamInfo[]): Compatibility {
  const rates = streams.map((s) => s.sampleRate).filter((r): r is number => typeof r === 'number' && r > 0)
  const sampleRate = rates.length ? Math.max(...rates) : 44100
  const allMono = streams.length > 0 && streams.every((s) => s.channelLayout === 'mono')
  const target: ReencodeTarget = { sampleRate, channels: allMono ? 1 : 2 }

  const first = streams[0]
  const canCopy =
    streams.length > 0 &&
    first.codec === 'aac' &&
    streams.every(
      (s) =>
        s.codec === 'aac' &&
        s.sampleRate != null &&
        s.channelLayout != null &&
        s.codec === first.codec &&
        s.sampleRate === first.sampleRate &&
        s.channelLayout === first.channelLayout,
    )

  return { canCopy, target }
}

/**
 * Build the merged ffmetadata (global tags + [CHAPTER] blocks). Each part's
 * chapters are shifted onto a continuous timeline by the cumulative duration of
 * the parts before it. In 'keep' mode a part contributes its own chapters (a
 * chapterless part becomes one chapter titled by the file); in 'perFile' mode
 * every part becomes a single chapter titled by the file. Chapter ENDs are
 * derived from the next start (or the total duration), keeping the list
 * contiguous. Pure + unit-testable.
 */
export function buildMergeMetadata(
  metadata: ConversionMetadata,
  parts: MergePart[],
  opts: { chapterMode?: MergeChapterMode } = {},
): string {
  const chapterMode = opts.chapterMode ?? 'keep'

  const global: string[] = [';FFMETADATA1', ...buildGlobalMetadata(metadata)]

  const starts: { title: string; startMs: number }[] = []
  let offset = 0
  parts.forEach((part, i) => {
    const partTitle = part.title.trim() || `Part ${i + 1}`
    if (chapterMode === 'perFile' || part.chapters.length === 0) {
      starts.push({ title: partTitle, startMs: offset })
    } else {
      for (const c of part.chapters) {
        starts.push({ title: c.title.trim() || `Chapter ${starts.length + 1}`, startMs: offset + c.startMs })
      }
    }
    offset += part.durationMs
  })
  const total = offset

  starts.sort((a, b) => a.startMs - b.startMs)
  const marks: ChapterMark[] = starts.map((s, i) => ({
    title: s.title,
    startMs: s.startMs,
    endMs: i < starts.length - 1 ? starts[i + 1].startMs : total,
  }))

  const chapterBody = buildFFMetadata(marks).replace(/^;FFMETADATA1\n/, '')
  return `${global.join('\n')}\n${chapterBody}`
}

/** The concat demuxer list body referencing the per-part intermediates. Pure. */
export function buildConcatList(names: string[]): string {
  return names.map((n) => `file '${n}'`).join('\n') + '\n'
}

/** ffmpeg args to make a uniform audio-only COPY intermediate for one input. Pure. */
export function buildPartCopyArgs(o: { input: string; output: string }): string[] {
  return ['-hide_banner', '-i', o.input, '-map', '0:a', '-vn', '-c:a', 'copy', o.output]
}

/**
 * ffmpeg args to make a uniform audio-only RE-ENCODED intermediate for one
 * input, normalising sample rate + channels so all intermediates match. Pure.
 */
export function buildPartEncodeArgs(o: {
  input: string
  output: string
  bitrate: Bitrate
  target: ReencodeTarget
}): string[] {
  return [
    '-hide_banner',
    '-i', o.input,
    '-map', '0:a',
    '-vn',
    '-c:a', 'aac',
    '-b:a', `${o.bitrate}k`,
    '-ar', String(o.target.sampleRate),
    '-ac', String(o.target.channels),
    o.output,
  ]
}

/**
 * ffmpeg args for the final concat-copy mux: join the uniform intermediates,
 * attach the cover (if any) and our merged chapters/metadata. Pure.
 * `coverPath` null means no cover in the output.
 */
export function buildMergeMuxArgs(o: {
  listPath: string
  coverPath: string | null
  metaPath: string
  output: string
}): string[] {
  const args = ['-hide_banner', '-f', 'concat', '-safe', '0', '-i', o.listPath]
  if (o.coverPath) args.push('-i', o.coverPath)
  args.push('-i', o.metaPath)
  const metaIdx = o.coverPath ? 2 : 1
  args.push('-map', '0:a')
  if (o.coverPath) args.push('-map', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic')
  args.push(
    '-map_metadata', String(metaIdx),
    '-map_chapters', String(metaIdx),
    '-c:a', 'copy',
    '-metadata', 'media_type=2',
    '-metadata:s:a', 'pgap=1',
    '-movflags', '+faststart',
    '-f', 'mp4',
    o.output,
  )
  return args
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  return ext === 'm4b' || ext === 'm4a' ? ext : 'm4a'
}

function toBytes(data: unknown): Uint8Array<ArrayBuffer> {
  const u = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
  const b = new Uint8Array(u.byteLength)
  b.set(u)
  return b
}

const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

export interface MergeOptions {
  /** Input files in final (merge) order. */
  files: File[]
  /** Per-file timeline, parallel to `files`. */
  parts: MergePart[]
  metadata: ConversionMetadata
  chapterMode: MergeChapterMode
  cover: { mode: MergeCoverMode; file?: File | null }
  /** For cover mode 'keep': index of the input to lift the cover from. */
  coverSourceIndex?: number | null
  /** True when the inputs must be re-encoded to a common AAC target. */
  reencode: boolean
  bitrate: Bitrate
  target: ReencodeTarget
  /** Sum of all part durations in ms — drives the mux progress bar. */
  totalDurationMs: number
  onProgress?: (p: ConversionProgress) => void
}

/**
 * Merge several M4B/M4A files into one audiobook, offsetting each part's
 * chapters onto a continuous timeline. Compatible inputs are stream-copied
 * (fast, lossless); mismatched inputs are re-encoded to a common AAC target.
 * All in-browser; nothing is uploaded.
 */
export async function mergeM4B(opts: MergeOptions): Promise<Blob> {
  const {
    files, parts, metadata, chapterMode, cover, coverSourceIndex,
    reencode, bitrate, target, totalDurationMs, onProgress,
  } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await getFFmpeg()

  const tempPaths: string[] = []
  const partNames: string[] = []

  try {
    // Cover: a user replacement is resized up front; a kept cover is extracted
    // from its source input inside the loop below (the input is written there).
    let coverPath: string | null = null
    if (cover.mode === 'replace' && cover.file) {
      const resized = await resizeCoverImage(cover.file)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      coverPath = COVER_PATH
      tempPaths.push(COVER_PATH)
    }

    // Per-file intermediates. Write → prepare → delete each input to keep memory
    // down; only the (smaller) intermediates accumulate for the final concat.
    const slice = 78 / Math.max(1, files.length)
    for (let i = 0; i < files.length; i++) {
      const inputPath = `merge_in_${i}.${fileExtension(files[i].name)}`
      await ffmpeg.writeFile(inputPath, await fetchFile(files[i]))

      if (cover.mode === 'keep' && coverSourceIndex === i && coverPath === null) {
        try {
          await ffmpeg.exec(['-hide_banner', '-i', inputPath, '-an', '-map', '0:v', '-c', 'copy', COVER_PATH])
          coverPath = COVER_PATH
          tempPaths.push(COVER_PATH)
        } catch {
          coverPath = null
        }
      }

      const out = partName(i)
      const base = 6 + slice * i
      const onProg = ({ progress }: { progress: number }) => {
        const frac = Math.max(0, Math.min(1, progress))
        emit({
          status: reencode ? 'encoding' : 'concatenating',
          percent: Math.min(84, Math.round(base + slice * frac)),
          label: reencode
            ? `Re-encoding part ${i + 1} of ${files.length}…`
            : `Preparing part ${i + 1} of ${files.length}…`,
        })
      }
      emit({
        status: reencode ? 'encoding' : 'concatenating',
        percent: Math.round(base),
        label: reencode
          ? `Re-encoding part ${i + 1} of ${files.length}…`
          : `Preparing part ${i + 1} of ${files.length}…`,
      })
      ffmpeg.on('progress', onProg)
      try {
        await ffmpeg.exec(
          reencode
            ? buildPartEncodeArgs({ input: inputPath, output: out, bitrate, target })
            : buildPartCopyArgs({ input: inputPath, output: out }),
        )
      } finally {
        ffmpeg.off('progress', onProg)
      }
      partNames.push(out)
      tempPaths.push(out)
      try { await ffmpeg.deleteFile(inputPath) } catch { /* ignore */ }
    }

    await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(buildConcatList(partNames)))
    tempPaths.push(LIST_PATH)
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(buildMergeMetadata(metadata, parts, { chapterMode })))
    tempPaths.push(META_PATH)

    emit({ status: 'muxing', percent: 86, label: 'Joining into one audiobook…' })
    const onLog = ({ message }: { message: string }) => {
      if (totalDurationMs <= 0) return
      const m = message.match(TIME_RE)
      if (!m) return
      const elapsedMs =
        ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
      emit({
        status: 'muxing',
        percent: Math.min(99, 86 + Math.round(Math.max(0, Math.min(1, elapsedMs / totalDurationMs)) * 13)),
        label: 'Joining into one audiobook…',
      })
    }
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(buildMergeMuxArgs({ listPath: LIST_PATH, coverPath, metaPath: META_PATH, output: OUTPUT_PATH }))
    } finally {
      ffmpeg.off('log', onLog)
    }
    tempPaths.push(OUTPUT_PATH)

    const blob = new Blob([toBytes(await ffmpeg.readFile(OUTPUT_PATH))], { type: 'audio/mp4' })
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    console.error('mp3tom4b merge failed:', err)
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
