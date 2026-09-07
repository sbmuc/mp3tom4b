'use client'

import { fetchFile } from '@ffmpeg/util'
import type { ConversionMetadata, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'
import { buildFFMetadata } from './chapters'
import type { ChapterMark } from './types'
import { resizeCoverImage } from '@/lib/image/resize'

const OUTPUT_PATH = 'edit_out.m4b'
const META_PATH = 'edit_meta.ffmeta'
const COVER_PATH = 'edit_cover.jpg'

export interface EditChapter {
  startMs: number
  title: string
}

export type CoverMode = 'keep' | 'replace' | 'remove'

/** ffmetadata escaping (=, ;, #, \, newline). Mirrors chapters.ts. */
function esc(value: string): string {
  return value.replace(/([\\=;#\n])/g, '\\$1')
}

/**
 * Build an ffmetadata file (global tags + [CHAPTER] blocks) from the edited
 * chapters + metadata. Chapters are sorted by start; each END is the next
 * chapter's start (or the file duration for the last). Pure + unit-testable.
 */
export function buildEditMetadata(
  metadata: ConversionMetadata,
  chapters: EditChapter[],
  durationMs: number,
): string {
  const global: string[] = [';FFMETADATA1']
  global.push(`title=${esc(metadata.title)}`)
  global.push(`artist=${esc(metadata.author)}`)
  global.push(`album=${esc(metadata.title)}`)
  global.push(`album_artist=${esc(metadata.author)}`)
  if (metadata.narrator) global.push(`composer=${esc(metadata.narrator)}`)
  if (metadata.year) global.push(`date=${esc(metadata.year)}`)
  global.push(`genre=${esc(metadata.genre)}`)

  const sorted = [...chapters].sort((a, b) => a.startMs - b.startMs)
  const marks: ChapterMark[] = sorted.map((c, i) => ({
    title: c.title.trim() || `Chapter ${i + 1}`,
    startMs: c.startMs,
    endMs: i < sorted.length - 1 ? sorted[i + 1].startMs : durationMs,
  }))

  const chapterBody = buildFFMetadata(marks).replace(/^;FFMETADATA1\n/, '')
  return `${global.join('\n')}\n${chapterBody}`
}

/**
 * ffmpeg args for the edit remux — audio (and optionally the cover) are stream-
 * copied; only chapters/metadata/cover change. `-map_chapters` is explicit so our
 * edited chapters override the source's originals. Pure + unit-testable.
 */
export function buildEditMuxArgs(o: {
  input: string
  coverMode: CoverMode
  coverPath: string
  metaPath: string
  output: string
}): string[] {
  const args = ['-hide_banner', '-i', o.input]
  if (o.coverMode === 'replace') args.push('-i', o.coverPath)
  args.push('-i', o.metaPath)

  const metaIdx = o.coverMode === 'replace' ? 2 : 1
  args.push('-map', '0:a')
  if (o.coverMode === 'keep') {
    args.push('-map', '0:v?', '-c', 'copy', '-disposition:v', 'attached_pic')
  } else if (o.coverMode === 'replace') {
    args.push('-map', '1', '-c:a', 'copy', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic')
  } else {
    // remove: audio only
    args.push('-c:a', 'copy')
  }
  args.push(
    '-map_metadata', String(metaIdx),
    '-map_chapters', String(metaIdx),
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

export interface EditOptions {
  file: File
  chapters: EditChapter[]
  metadata: ConversionMetadata
  cover: { mode: CoverMode; file?: File | null }
  durationMs: number
  onProgress?: (p: ConversionProgress) => void
}

/**
 * Apply edited chapters, metadata, and cover to an existing M4B/M4A. The audio
 * is stream-copied (no re-encode), so it's fast and lossless. All in-browser.
 */
export async function editM4B(opts: EditOptions): Promise<Blob> {
  const { file, chapters, metadata, cover, durationMs, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await getFFmpeg()

  const inputPath = `edit_in.${fileExtension(file.name)}`
  const tempPaths: string[] = []

  try {
    emit({ status: 'muxing', percent: 8, label: 'Reading file…' })
    await ffmpeg.writeFile(inputPath, await fetchFile(file))
    tempPaths.push(inputPath)

    if (cover.mode === 'replace' && cover.file) {
      const resized = await resizeCoverImage(cover.file)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      tempPaths.push(COVER_PATH)
    }

    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(buildEditMetadata(metadata, chapters, durationMs)))
    tempPaths.push(META_PATH)

    emit({ status: 'muxing', percent: 15, label: 'Saving changes…' })
    const args = buildEditMuxArgs({
      input: inputPath,
      coverMode: cover.mode,
      coverPath: COVER_PATH,
      metaPath: META_PATH,
      output: OUTPUT_PATH,
    })

    // A stream-copy remux rarely fires the 'progress' event, so parse time= from
    // the log against the known duration.
    const onLog = ({ message }: { message: string }) => {
      if (durationMs <= 0) return
      const m = message.match(TIME_RE)
      if (!m) return
      const elapsedMs =
        ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
      emit({
        status: 'muxing',
        percent: Math.min(99, 15 + Math.round(Math.max(0, Math.min(1, elapsedMs / durationMs)) * 84)),
        label: 'Saving changes…',
      })
    }
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(args)
    } finally {
      ffmpeg.off('log', onLog)
    }
    tempPaths.push(OUTPUT_PATH)

    const data = await ffmpeg.readFile(OUTPUT_PATH)
    const src = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    const bytes = new Uint8Array(src.byteLength)
    bytes.set(src)
    const blob = new Blob([bytes], { type: 'audio/mp4' })

    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    console.error('mp3tom4b edit failed:', err)
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
