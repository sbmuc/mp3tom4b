'use client'

import type { Bitrate, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { replaceChapters } from './chapters'
import { allKnown, buildTimedConcatList, parseSegmentStarts, remapThroughSegments } from './concatPlan'
import { humanizeFfmpegError } from './errors'
import { mountBlobs, ownedBytes, takeBlob, unmount } from './files'
import { encodeConcurrency, encodeSegmentsInWorkers } from './segments'
import { parseChapters, type Chapter } from './splitChapters'

const OUTPUT_PATH = 'compress_out.m4b'
const META_PATH = 'compress_meta.ffmeta'
const COVER_PATH = 'compress_cover.jpg'
const LIST_PATH = 'compress_list.txt'
const SEG_LIST_PATH = 'compress_segments.csv'
// The source and the re-encoded pieces are mounted, not copied in (see files.ts).
const INPUT_DIR = '/mnt_compress_in'
const PARTS_DIR = '/mnt_compress_parts'

const SEG_SRC_PATTERN = 'seg_src_%03d.m4a'
const segSrc = (i: number) => `seg_src_${String(i).padStart(3, '0')}.m4a`
const encName = (i: number) => `enc_${String(i).padStart(3, '0')}.m4a`

export interface CompressOptions {
  file: File
  bitrate: Bitrate
  /** Whether the source has an embedded cover (mjpeg attached_pic) to preserve. */
  hasCover: boolean
  /** Total duration in ms, from the probe — used for log-based progress. */
  durationMs?: number
  onProgress?: (p: ConversionProgress) => void
}

export interface CompressArgsOptions {
  input: string
  output: string
  bitrate: Bitrate
  hasCover: boolean
}

/**
 * Build the ffmpeg argument list for the SERIAL path: re-encode the audio to a
 * lower AAC bitrate in one exec while copying the cover, chapters, and metadata
 * through unchanged. Used for chapterless files and single-core devices. Pure.
 */
export function buildCompressArgs(opts: CompressArgsOptions): string[] {
  const { input, output, bitrate, hasCover } = opts
  const args = [
    '-hide_banner',
    '-i', input,
    '-map', '0:a',
    '-map', '0:v?',
    '-c:a', 'aac',
    '-b:a', `${bitrate}k`,
    '-c:v', 'copy',
  ]
  if (hasCover) {
    args.push('-disposition:v', 'attached_pic')
  }
  args.push(
    '-map_metadata', '0',
    '-map_chapters', '0',
    // stik=2 marks the file as an Audiobook (resume position, correct shelf);
    // pgap enables gapless playback. Set after -map_metadata so they win.
    '-metadata', 'media_type=2',
    '-metadata:s:a', 'pgap=1',
    '-movflags', '+faststart',
    '-f', 'mp4',
    output,
  )
  return args
}

/**
 * Segment split points (seconds, comma-joined) for `-segment_times`: the start
 * of every chapter after the first. N chapters → N-1 boundaries → N segments. Pure.
 */
export function buildSegmentTimes(chapters: Chapter[]): string {
  return chapters
    .slice(1)
    .map((c) => (c.startMs / 1000).toFixed(3))
    .join(',')
}

/** ffmpeg args to re-encode one already-split segment to AAC. Pure. */
export function buildSegmentEncodeArgs(o: { input: string; output: string; bitrate: Bitrate }): string[] {
  return ['-hide_banner', '-i', o.input, '-vn', '-c:a', 'aac', '-b:a', `${o.bitrate}k`, o.output]
}

/**
 * ffmpeg args for the final concat + remux of the re-encoded segments, carrying
 * the original chapters + metadata (from the ffmetadata dump) and the cover. Pure.
 * `coverPath` null means the source had no cover.
 */
export function buildParallelMuxArgs(o: {
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
  return ext === 'm4b' || ext === 'm4a' ? ext : 'm4b'
}

const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

/**
 * Shrink an existing M4B/M4A to a lower bitrate, preserving chapters, metadata,
 * and cover. Chaptered books are split at chapter boundaries and re-encoded in
 * parallel (≈2–3× faster); chapterless files fall back to a single serial exec.
 * All in-browser; the file is never uploaded.
 */
export async function compressM4B(opts: CompressOptions): Promise<Blob> {
  const { file, bitrate, hasCover, durationMs, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await getFFmpeg()

  const inputName = `in.${fileExtension(file.name)}`
  const inputPath = `${INPUT_DIR}/${inputName}`
  const tempPaths: string[] = []

  try {
    emit({ status: 'encoding', percent: 4, label: 'Reading file…' })
    await mountBlobs(ffmpeg, INPUT_DIR, [{ name: inputName, data: file }])

    // Dump original global metadata + chapters once; drives the split decision
    // and is reused verbatim in the parallel final mux.
    let chapters: Chapter[] = []
    let metaText = ''
    try {
      await ffmpeg.exec(['-hide_banner', '-i', inputPath, '-f', 'ffmetadata', META_PATH])
      tempPaths.push(META_PATH)
      metaText = new TextDecoder().decode(ownedBytes(await ffmpeg.readFile(META_PATH)))
      chapters = parseChapters(metaText)
    } catch {
      chapters = []
    }

    const useParallel = chapters.length >= 2 && encodeConcurrency(chapters.length) > 1

    if (useParallel) {
      // Extract the cover once (re-embedded at the final mux).
      let coverPath: string | null = null
      if (hasCover) {
        try {
          await ffmpeg.exec(['-hide_banner', '-i', inputPath, '-an', '-map', '0:v', '-c', 'copy', COVER_PATH])
          coverPath = COVER_PATH
          tempPaths.push(COVER_PATH)
        } catch {
          coverPath = null
        }
      }

      emit({ status: 'encoding', percent: 8, label: 'Splitting into chapters…' })
      await ffmpeg.exec([
        '-hide_banner', '-i', inputPath, '-vn', '-c:a', 'copy',
        '-f', 'segment', '-segment_times', buildSegmentTimes(chapters),
        '-segment_list', SEG_LIST_PATH, '-segment_list_type', 'csv',
        '-reset_timestamps', '1', SEG_SRC_PATTERN,
      ])
      tempPaths.push(SEG_LIST_PATH)
      for (let i = 0; i < chapters.length; i++) tempPaths.push(segSrc(i))
      // Where each piece really starts (the copy split cuts on a packet).
      let segStarts: number[] | null = null
      try {
        segStarts = parseSegmentStarts(new TextDecoder().decode(ownedBytes(await ffmpeg.readFile(SEG_LIST_PATH))), chapters.length)
      } catch {
        segStarts = null
      }

      // Hand the pieces to the browser as Blobs, so none stays in this page's
      // memory while the workers encode them.
      const segments: Blob[] = []
      for (let i = 0; i < chapters.length; i++) segments.push(await takeBlob(ffmpeg, segSrc(i)))
      await unmount(ffmpeg, INPUT_DIR)

      const count = segments.length
      const { parts, decodedSec } = await encodeSegmentsInWorkers(segments, {
        ext: 'm4a',
        args: (input, output) => buildSegmentEncodeArgs({ input, output, bitrate }),
        onProgress: (sum, done) =>
          emit({
            status: 'encoding',
            percent: Math.min(90, 15 + Math.round((sum / count) * 75)),
            label: `Compressing chapters… (${done} of ${count} done)`,
          }),
      })
      await mountBlobs(ffmpeg, PARTS_DIR, parts.map((data, i) => ({ name: encName(i), data })))

      // Join with each piece's real decoded length, and move every chapter
      // marker by the same amount, so the markers stay on the audio.
      const listBody = buildTimedConcatList(
        chapters.map((_, i) => ({ name: `${PARTS_DIR}/${encName(i)}`, durationSec: decodedSec[i] })),
      )
      await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
      tempPaths.push(LIST_PATH)
      const known = allKnown(decodedSec)
      if (known) {
        const boundaries = segStarts ?? [0, ...chapters.slice(1).map((c) => c.startMs)]
        const starts = chapters.map((c) => remapThroughSegments(c.startMs, boundaries, known))
        const totalMs = known.reduce((a, s) => a + s * 1000, 0)
        const marks = chapters.map((c, i) => ({ title: c.title, startMs: starts[i], endMs: starts[i + 1] ?? totalMs }))
        await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(replaceChapters(metaText, marks)))
      }

      emit({ status: 'muxing', percent: 92, label: 'Finalizing audiobook…' })
      tempPaths.push(OUTPUT_PATH)
      await ffmpeg.exec(buildParallelMuxArgs({ listPath: LIST_PATH, coverPath, metaPath: META_PATH, output: OUTPUT_PATH }))
      await unmount(ffmpeg, PARTS_DIR)

      const blob = await takeBlob(ffmpeg, OUTPUT_PATH)
      emit({ status: 'done', percent: 100, label: 'Done.' })
      return blob
    }

    // ---- Serial fallback (chapterless / single-core): one re-encode exec ----
    emit({ status: 'encoding', percent: 10, label: 'Compressing audio…' })
    const encPercent = (ratio: number) =>
      Math.min(99, 10 + Math.round(Math.max(0, Math.min(1, ratio)) * 89))
    const onProg = ({ progress }: { progress: number }) => {
      emit({ status: 'encoding', percent: encPercent(progress), label: 'Compressing audio…' })
    }
    const onLog = ({ message }: { message: string }) => {
      if (!durationMs || durationMs <= 0) return
      const m = message.match(TIME_RE)
      if (!m) return
      const elapsedMs =
        ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
      emit({ status: 'encoding', percent: encPercent(elapsedMs / durationMs), label: 'Compressing audio…' })
    }
    tempPaths.push(OUTPUT_PATH)
    ffmpeg.on('progress', onProg)
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(buildCompressArgs({ input: inputPath, output: OUTPUT_PATH, bitrate, hasCover }))
    } finally {
      ffmpeg.off('progress', onProg)
      ffmpeg.off('log', onLog)
    }
    await unmount(ffmpeg, INPUT_DIR)

    const blob = await takeBlob(ffmpeg, OUTPUT_PATH)
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    console.error('mp3tom4b compression failed:', err)
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
