'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

// Single-threaded core for maximum browser compatibility (no SharedArrayBuffer dependency).
const CORE_VERSION = '0.12.6'
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

/**
 * Lazy-load and cache a singleton FFmpeg instance.
 * The wasm core is fetched from a public CDN on first use only — no audio
 * data ever leaves the browser; the only outbound request is for the
 * (signed, content-addressable) ffmpeg core binary itself.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    ])
    await ffmpeg.load({ coreURL, wasmURL })
    instance = ffmpeg
    return ffmpeg
  })()

  return loadPromise
}

export function isFFmpegLoaded(): boolean {
  return instance !== null
}
