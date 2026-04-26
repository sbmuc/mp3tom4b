'use client'

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './client'

const DURATION_RE = /Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

/**
 * Probe an audio file to extract its duration in milliseconds.
 * Runs `ffmpeg -i <file>` and parses the Duration line from the log output.
 */
export async function probeDurationMs(file: File, virtualName: string): Promise<number> {
  const ffmpeg = await getFFmpeg()

  const lines: string[] = []
  const handler = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', handler)

  try {
    await ffmpeg.writeFile(virtualName, await fetchFile(file))
    // ffmpeg with `-i` and no output exits non-zero but logs the duration we need.
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
      // ignore — file may not exist
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
