'use client'

import { fetchFile } from '@ffmpeg/util'
import { zip } from 'fflate'
import type { Bitrate, ConversionProgress } from '@/types'
import { ffmpegLoadingLabel, getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'
import type { Chapter } from './splitChapters'

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

  const inName = `split_in.${fileExtension(file.name)}`
  const temp: string[] = []
  const album = meta.album ? sanitize(meta.album) : ''
  const artist = meta.artist ? sanitize(meta.artist) : ''
  const bookBase = album || sanitize(fileBaseName(file.name)) || 'audiobook'

  try {
    emit({ status: 'encoding', percent: 5, label: 'Reading file…' })
    await ffmpeg.writeFile(inName, await fetchFile(file))
    temp.push(inName)

    // No chapters → one whole-file MP3.
    const segments: Chapter[] =
      chapters.length > 0 ? chapters : [{ title: bookBase, startMs: 0, endMs: 0 }]
    const total = segments.length
    const padWidth = Math.max(2, String(total).length)

    const outputs: { name: string; bytes: Uint8Array<ArrayBuffer> }[] = []

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

      await ffmpeg.exec(
        buildSplitChapterArgs({
          input: inName,
          output: outName,
          startSec,
          durationSec,
          bitrate,
          meta: { title: titleText, track: `${i + 1}/${total}`, album, artist },
        }),
      )

      const data = await ffmpeg.readFile(outName)
      const src = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
      const bytes = new Uint8Array(src.byteLength)
      bytes.set(src)
      const displayName =
        total > 1 ? `${String(i + 1).padStart(padWidth, '0')} - ${sanitize(titleText)}.mp3` : `${bookBase}.mp3`
      outputs.push({ name: displayName, bytes })
      try {
        await ffmpeg.deleteFile(outName)
      } catch {
        /* ignore */
      }
    }

    if (outputs.length === 1) {
      emit({ status: 'done', percent: 100, label: 'Done.' })
      return {
        blob: new Blob([outputs[0].bytes], { type: 'audio/mpeg' }),
        filename: outputs[0].name,
        count: 1,
      }
    }

    emit({ status: 'muxing', percent: 95, label: 'Packaging ZIP…' })
    const entries: Record<string, Uint8Array> = {}
    for (const out of outputs) entries[out.name] = out.bytes
    const zipped = await new Promise<Uint8Array>((resolve, reject) => {
      // level 0 (STORE): MP3 is already compressed, so don't waste time re-deflating.
      zip(entries, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)))
    })

    emit({ status: 'done', percent: 100, label: 'Done.' })
    return {
      blob: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
      filename: `${bookBase}.zip`,
      count: outputs.length,
    }
  } catch (err) {
    console.error('mp3tom4b split failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    for (const path of temp) {
      try {
        await ffmpeg.deleteFile(path)
      } catch {
        /* ignore */
      }
    }
  }
}
