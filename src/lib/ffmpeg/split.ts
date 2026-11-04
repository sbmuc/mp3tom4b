'use client'

import { createStoredZip } from '@/lib/archive/zip'
import type { Bitrate, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'
import { mountBlobs, takeBytes, unmount } from './files'
import type { Chapter } from './splitChapters'
import { runFFmpeg } from './run'

// The source is mounted, not copied in (see files.ts).
const INPUT_DIR = '/mnt_split_in'

export interface SplitArgsOptions {
  input: string
  output: string
  startSec: number
  durationSec: number
  bitrate: Bitrate
  meta: { title: string; track: string; album?: string; artist?: string }
}

/**
 * Build the ffmpeg args to extract one chapter of an M4B as an MP3.
 * `-ss` before `-i` is a fast input seek; `-t` bounds the duration. Both are
 * omitted for a whole-file export (startSec/durationSec = 0). Pure + testable.
 */
export function buildSplitChapterArgs(o: SplitArgsOptions): string[] {
  const args = ['-hide_banner']
  if (o.startSec > 0) args.push('-ss', String(o.startSec))
  args.push('-i', o.input)
  if (o.durationSec > 0) args.push('-t', String(o.durationSec))
  args.push(
    '-vn',
    '-c:a', 'libmp3lame',
    '-b:a', `${o.bitrate}k`,
    '-id3v2_version', '3',
    '-metadata', `title=${o.meta.title}`,
    '-metadata', `track=${o.meta.track}`,
  )
  if (o.meta.album) args.push('-metadata', `album=${o.meta.album}`)
  if (o.meta.artist) args.push('-metadata', `artist=${o.meta.artist}`)
  args.push(o.output)
  return args
}

export interface SplitOptions {
  file: File
  bitrate: Bitrate
  chapters: Chapter[]
  meta: { album?: string; artist?: string }
  onProgress?: (p: ConversionProgress) => void
}

export interface SplitResult {
  blob: Blob
  filename: string
  /** Number of MP3 files produced (1 = single whole-file export, no ZIP). */
  count: number
}

function sanitize(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  return ext === 'm4b' || ext === 'm4a' ? ext : 'm4b'
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/**
 * Split an M4B/M4A into per-chapter MP3 files (bundled as a ZIP), or a single
 * MP3 when the file has no chapters. All processing is in-browser; nothing is
 * uploaded.
 */
export async function splitM4B(opts: SplitOptions): Promise<SplitResult> {
  const { file, bitrate, chapters, meta, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await getFFmpeg()

  const inputName = `split_in.${fileExtension(file.name)}`
  const inName = `${INPUT_DIR}/${inputName}`
  const temp: string[] = []
  const album = meta.album ? sanitize(meta.album) : ''
  const artist = meta.artist ? sanitize(meta.artist) : ''
  const bookBase = album || sanitize(fileBaseName(file.name)) || 'audiobook'

  try {
    emit({ status: 'encoding', percent: 5, label: 'Reading file…' })
    await mountBlobs(ffmpeg, INPUT_DIR, [{ name: inputName, data: file }])

    // No chapters → one whole-file MP3.
    const segments: Chapter[] =
      chapters.length > 0 ? chapters : [{ title: bookBase, startMs: 0, endMs: 0 }]
    const total = segments.length
    const padWidth = Math.max(2, String(total).length)

    // Each MP3 goes into the ZIP (or becomes the single file) as soon as it's
    // made, so a whole book of MP3s is never held in the page's memory, and
    // the archive isn't a second copy of it.
    const archive = total > 1 ? createStoredZip() : null
    let single: { blob: Blob; name: string } | null = null

    for (let i = 0; i < total; i++) {
      const ch = segments[i]
      const startSec = ch.startMs / 1000
      const durationSec = ch.endMs > ch.startMs ? (ch.endMs - ch.startMs) / 1000 : 0
      const titleText = ch.title?.trim() || `Chapter ${i + 1}`
      const outName = `seg_${i}.mp3`

      emit({
        status: 'encoding',
        percent: 5 + Math.round((i / total) * 88),
        label: total > 1 ? `Encoding chapter ${i + 1} of ${total}…` : 'Encoding audio…',
      })

      temp.push(outName)
      await runFFmpeg(
        ffmpeg,
        buildSplitChapterArgs({
          input: inName,
          output: outName,
          startSec,
          durationSec,
          bitrate,
          meta: { title: titleText, track: `${i + 1}/${total}`, album, artist },
        }),
      )

      const bytes = await takeBytes(ffmpeg, outName)
      if (archive) {
        archive.add(`${String(i + 1).padStart(padWidth, '0')} - ${sanitize(titleText)}.mp3`, bytes)
      } else {
        single = { blob: new Blob([bytes], { type: 'audio/mpeg' }), name: `${bookBase}.mp3` }
      }
    }
    await unmount(ffmpeg, INPUT_DIR)

    if (!archive) {
      emit({ status: 'done', percent: 100, label: 'Done.' })
      return { blob: single!.blob, filename: single!.name, count: 1 }
    }

    emit({ status: 'muxing', percent: 95, label: 'Packaging ZIP…' })
    const blob = archive.finish()
    emit({ status: 'done', percent: 100, label: 'Done.' })
    return { blob, filename: `${bookBase}.zip`, count: total }
  } catch (err) {
    console.error('mp3tom4b split failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    await unmount(ffmpeg, INPUT_DIR)
    for (const path of temp) {
      try {
        await ffmpeg.deleteFile(path)
      } catch {
        /* ignore */
      }
    }
  }
}
