'use client'

import { fetchFile } from '@ffmpeg/util'
import type { Bitrate, ConversionProgress } from '@/types'
import { getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'

const OUTPUT_PATH = 'compress_out.m4b'

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
 * Build the ffmpeg argument list to shrink an existing M4B/M4A: re-encode only
 * the audio stream to a lower AAC bitrate while copying the cover art, chapter
 * markers, and global metadata through unchanged. Pure + unit-testable.
 *
 * `-map 0:v?` optionally carries the cover (a no-op when absent, and robust to a
 * probe that misses it, since `-c:v copy` preserves the source disposition). The
 * explicit `-disposition:v attached_pic` is added when we know a cover is present.
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

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  return ext === 'm4b' || ext === 'm4a' ? ext : 'm4b'
}

const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

/**
 * Re-encode an existing M4B/M4A audiobook to a lower bitrate, preserving its
 * chapters, metadata, and cover. All processing happens in-browser via
 * ffmpeg.wasm; the file is never uploaded.
 */
export async function compressM4B(opts: CompressOptions): Promise<Blob> {
  const { file, bitrate, hasCover, durationMs, onProgress } = opts
  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: 'Loading converter…' })
  const ffmpeg = await getFFmpeg()

  const inputPath = `compress_in.${fileExtension(file.name)}`
  const tempPaths: string[] = []

  // Encoding occupies the visible 10–99 range.
  const encPercent = (ratio: number) =>
    Math.min(99, 10 + Math.round(Math.max(0, Math.min(1, ratio)) * 89))

  try {
    emit({ status: 'encoding', percent: 6, label: 'Reading file…' })
    await ffmpeg.writeFile(inputPath, await fetchFile(file))
    tempPaths.push(inputPath)

    emit({ status: 'encoding', percent: 10, label: 'Compressing audio…' })
    const args = buildCompressArgs({ input: inputPath, output: OUTPUT_PATH, bitrate, hasCover })

    // A real transcode fires the 'progress' event; the time= log line is a
    // backup (and more reliable on some cores) when a duration is known.
    const onProg = ({ progress }: { progress: number }) => {
      emit({ status: 'encoding', percent: encPercent(progress), label: 'Compressing audio…' })
    }
    const onLog = ({ message }: { message: string }) => {
      if (!durationMs || durationMs <= 0) return
      const m = message.match(TIME_RE)
      if (!m) return
      const elapsedMs =
        ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 +
          Number(m[4].padEnd(2, '0'))) * 10
      emit({ status: 'encoding', percent: encPercent(elapsedMs / durationMs), label: 'Compressing audio…' })
    }
    ffmpeg.on('progress', onProg)
    ffmpeg.on('log', onLog)
    try {
      await ffmpeg.exec(args)
    } finally {
      ffmpeg.off('progress', onProg)
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
    console.error('mp3tom4b compression failed:', err)
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
