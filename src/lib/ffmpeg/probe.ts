'use client'

import type { FFFSType } from '@ffmpeg/ffmpeg'
import { getFFmpeg } from './client'
import { oneAtATime } from './serial'

const DURATION_RE = /Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d{1,2})/
// The file is mounted, not copied into memory (see convert.ts).
const PROBE_DIR = '/mnt_probe'

/**
 * Decode just enough of the file to read its duration via the browser's
 * native HTMLAudioElement. Reliable for any format the browser can play
 * (mp3, m4a, wav, ogg, opus and on most browsers flac).
 *
 * Exported so the drop zone can cheaply tell "unreadable" from "no duration in
 * the tags" without pulling in the ~31 MB ffmpeg core.
 */
export function probeDurationViaAudioElement(file: File): Promise<number | null> {
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
  return oneAtATime(() => probeDurationWithFFmpeg(file, virtualName))
}

async function probeDurationWithFFmpeg(file: File, virtualName: string): Promise<number> {
  const ffmpeg = await getFFmpeg()

  const lines: string[] = []
  const handler = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', handler)

  try {
    try {
      await ffmpeg.createDir(PROBE_DIR)
    } catch {
      // left over from an earlier probe
    }
    await ffmpeg.mount('WORKERFS' as FFFSType, { blobs: [{ name: virtualName, data: file }] }, PROBE_DIR)
    try {
      await ffmpeg.exec(['-hide_banner', '-i', `${PROBE_DIR}/${virtualName}`, '-f', 'null', '-'])
    } catch {
      // expected — we only care about the log
    }
  } finally {
    ffmpeg.off('log', handler)
    try {
      await ffmpeg.unmount(PROBE_DIR)
    } catch {
      // not mounted
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
