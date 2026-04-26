'use client'

import { fetchFile } from '@ffmpeg/util'
import type { AudioFile, Bitrate, ConversionMetadata, ConversionProgress } from '@/types'
import { resizeCoverImage } from '@/lib/image/resize'
import { buildChapters, buildFFMetadata } from './chapters'
import { getFFmpeg } from './client'
import { probeDurationMs } from './probe'

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

  // Track all virtual paths we create so we can clean up at the end.
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
      const probeName = `probe_${i}.${ext}`
      const durationMs = await probeDurationMs(f.file, probeName)
      segments.push({ title: f.chapterTitle, durationMs, ext })
    }

    // 2. Encode each input to AAC at the chosen bitrate
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = segments[i].ext
      const inPath = inputName(i, ext)
      const outPath = encodedName(i)
      tempPaths.push(inPath, outPath)

      const encodeProgress = (p: { progress: number }) => {
        const fileShare = 1 / files.length
        const localPercent = Math.max(0, Math.min(1, p.progress)) * fileShare
        const overall = 10 + Math.round((i * fileShare + localPercent) * 70)
        emit({
          status: 'encoding',
          percent: Math.min(80, overall),
          label: `Encoding chapter ${i + 1} of ${files.length}…`,
        })
      }
      ffmpeg.on('progress', encodeProgress)

      try {
        await ffmpeg.writeFile(inPath, await fetchFile(f.file))
        await ffmpeg.exec([
          '-hide_banner',
          '-i', inPath,
          '-vn',
          '-c:a', 'aac',
          '-b:a', `${bitrate}k`,
          outPath,
        ])
      } finally {
        ffmpeg.off('progress', encodeProgress)
        await safeDelete(inPath)
      }
    }

    // 3. Concat list file
    emit({ status: 'concatenating', percent: 82, label: 'Joining chapters…' })
    const listBody = segments.map((_, i) => `file '${encodedName(i)}'`).join('\n') + '\n'
    await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
    tempPaths.push(LIST_PATH)

    // 4. Chapter metadata
    const chapters = buildChapters(segments.map((s) => ({ title: s.title, durationMs: s.durationMs })))
    const ffmetaBody = buildFFMetadata(chapters)
    // Prepend high-level container metadata
    const containerMeta =
      `;FFMETADATA1\n` +
      `title=${metadata.title}\n` +
      `artist=${metadata.author}\n` +
      `album=${metadata.title}\n` +
      `album_artist=${metadata.author}\n` +
      (metadata.narrator ? `composer=${metadata.narrator}\n` : '') +
      (metadata.year ? `date=${metadata.year}\n` : '') +
      `genre=${metadata.genre}\n`
    // The chapter section already begins with ;FFMETADATA1 — strip the duplicate header.
    const ffmetaCombined = containerMeta + ffmetaBody.replace(/^;FFMETADATA1\n/, '')
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(ffmetaCombined))
    tempPaths.push(META_PATH)

    // 5. Cover art (resized through the existing helper)
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

    // map: audio from concat list, optional cover image, metadata from ffmeta
    muxArgs.push('-map', '0:a', '-map_metadata', String(hasCover ? 2 : 1))
    if (hasCover) {
      muxArgs.push('-map', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic')
    }
    muxArgs.push('-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', OUTPUT_PATH)

    const muxProgress = (p: { progress: number }) => {
      const local = Math.max(0, Math.min(1, p.progress))
      emit({
        status: 'muxing',
        percent: Math.min(99, 90 + Math.round(local * 9)),
        label: 'Finalizing audiobook…',
      })
    }
    ffmpeg.on('progress', muxProgress)
    try {
      await ffmpeg.exec(muxArgs)
    } finally {
      ffmpeg.off('progress', muxProgress)
    }
    tempPaths.push(OUTPUT_PATH)

    const data = await ffmpeg.readFile(OUTPUT_PATH)
    const source = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    // Copy into a fresh ArrayBuffer — ffmpeg.wasm may return data backed by
    // SharedArrayBuffer, which the Blob constructor type signature rejects.
    const bytes = new Uint8Array(source.byteLength)
    bytes.set(source)
    const blob = new Blob([bytes], { type: 'audio/mp4' })

    emit({ status: 'done', percent: 100, label: 'Done.' })
    return blob
  } catch (err) {
    emit({
      status: 'error',
      percent: 0,
      label: err instanceof Error ? err.message : 'Conversion failed.',
    })
    throw err
  } finally {
    for (const path of tempPaths) {
      await safeDelete(path)
    }
  }
}
