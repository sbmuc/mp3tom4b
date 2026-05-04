'use client'

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './client'

const DURATION_RE = /Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

/**
 * Decode just enough of the file to read its duration via the browser's
 * native HTMLAudioElement. Reliable for any format the browser can play
 * (mp3, m4a, wav, ogg, opus and on most browsers flac).
 */
function probeDurationViaAudioElement(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false

    const finish = (result: number | null) => {
      if (settled) return
      settled = true
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
      resolve(result)
    }

    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration
      finish(isFinite(d) && d > 0 ? Math.round(d * 1000) : null)
    })
    audio.addEventListener('error', () => finish(null))
    // Timeout — some browsers stall on rare encodings.
    setTimeout(() => finish(null), 8000)
    audio.src = url
  })
}

/**
 * Probe an audio file to extract its duration in milliseconds.
 * Tries the browser-native path first, falls back to ffmpeg log parsing
 * only when the browser cannot decode the format.
 */
export async function probeDurationMs(file: File, virtualName: string): Promise<number> {
  const native = await probeDurationViaAudioElement(file)
  if (native != null) return native

  const ffmpeg = await getFFmpeg()

  const lines: string[] = []
  const handler = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', handler)

  try {
    await ffmpeg.writeFile(virtualName, await fetchFile(file))
    try {
      await ffmpeg.exec(['-hide_banner', '-i', virtualName, '-f', 'null', '-'])
    } catch {
      // expected — we only care about the log
    }
  } finally {
    ffmpeg.off('log', handler)
    try {
      await ffmpeg.deleteFile(virtualName)
    } catch {
      // ignore
    }
  }

  for (const line of lines) {
    const m = line.match(DURATION_RE)
    if (m) {
      const h = Number(m[1])
      const min = Number(m[2])
      const s = Number(m[3])
      const cs = Number(m[4].padEnd(2, '0'))
      return ((h * 3600 + min * 60 + s) * 100 + cs) * 10
    }
  }

  throw new Error(`Could not determine duration of ${file.name}`)
}
