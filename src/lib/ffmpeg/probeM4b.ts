'use client'

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './client'

export interface M4bProbeInfo {
  /** Duration in ms, or null if it couldn't be parsed. */
  durationMs: number | null
  /** Current overall bitrate in kbps, or null if not reported. */
  currentBitrateKbps: number | null
  /** Number of chapter markers found in the container. */
  chapterCount: number
  /** Whether the file carries an embedded cover (attached_pic video stream). */
  hasCover: boolean
}

const DURATION_RE = /Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d{1,2})/
const BITRATE_RE = /bitrate:\s*(\d+)\s*kb\/s/
const CHAPTER_RE = /Chapter #\d+:\d+/
const COVER_RE = /attached pic/i
const VIDEO_STREAM_RE = /Stream #\d+:\d+.*:\s*Video:/i

/**
 * Parse ffmpeg's `-i` header dump (one message per line) into structured M4B
 * info. Pure + unit-testable — no ffmpeg dependency.
 */
export function parseM4bProbe(logLines: string[]): M4bProbeInfo {
  let durationMs: number | null = null
  let currentBitrateKbps: number | null = null
  let chapterCount = 0
  let hasCover = false

  for (const line of logLines) {
    if (durationMs == null) {
      const d = line.match(DURATION_RE)
      if (d) {
        const h = Number(d[1])
        const mi = Number(d[2])
        const s = Number(d[3])
        const cs = Number(d[4].padEnd(2, '0'))
        durationMs = ((h * 3600 + mi * 60 + s) * 100 + cs) * 10
      }
    }
    if (currentBitrateKbps == null) {
      const b = line.match(BITRATE_RE)
      if (b) currentBitrateKbps = Number(b[1])
    }
    if (CHAPTER_RE.test(line)) chapterCount++
    if (!hasCover && (COVER_RE.test(line) || VIDEO_STREAM_RE.test(line))) hasCover = true
  }

  return { durationMs, currentBitrateKbps, chapterCount, hasCover }
}

/**
 * Probe an existing M4B/M4A for duration, current bitrate, chapter count, and
 * cover presence. Runs a single `ffmpeg -i` (no output) so it only reads the
 * container header — fast, no full decode. Runs entirely in-browser.
 */
export async function probeM4bInfo(file: File): Promise<M4bProbeInfo> {
  const ffmpeg = await getFFmpeg()
  const lines: string[] = []
  const handler = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', handler)

  const virtualName = `probe_m4b_${Date.now()}`
  try {
    await ffmpeg.writeFile(virtualName, await fetchFile(file))
    try {
      // No output file → ffmpeg exits with an error after printing the header.
      // We only care about the log it emits along the way.
      await ffmpeg.exec(['-hide_banner', '-i', virtualName])
    } catch {
      // expected
    }
  } finally {
    ffmpeg.off('log', handler)
    try {
      await ffmpeg.deleteFile(virtualName)
    } catch {
      // ignore
    }
  }

  return parseM4bProbe(lines)
}
