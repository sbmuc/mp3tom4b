'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { ConversionProgress } from '@/types'
import { getFFmpeg } from './client'
import { humanizeFfmpegError } from './errors'

/**
 * The shared engine for a tool run, or the run's error state when it can't be
 * had. Every tool used to await getFFmpeg() before its own try/catch, so a
 * failed download (offline, a blocker) never reached the code that shows an
 * error: the converter sat at "Downloading converter… 2%" for good.
 * `what` names the run in the console ("conversion", "split").
 */
export async function loadEngine(emit: (p: ConversionProgress) => void, what: string): Promise<FFmpeg> {
  try {
    return await getFFmpeg()
  } catch (err) {
    console.error(`mp3tom4b ${what} failed:`, err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  }
}
