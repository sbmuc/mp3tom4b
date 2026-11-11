'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { EngineLoadError } from './errors'

const CORE_VERSION = '0.12.6'
// Self-hosted ffmpeg-core to keep the privacy promise airtight: no third-party
// origin is contacted during conversion. Files live in public/ffmpeg/<ver>/
// and are served with a long immutable cache header (see next.config.js).
// The JS is patched so one instance survives many runs (see
// scripts/patch-ffmpeg-core.mjs); it has its own path so the cache picks it up.
// The wasm is the stock one, so returning visitors don't download it again.
const CORE_JS_URL = `/ffmpeg/${CORE_VERSION}-p2/ffmpeg-core.js`
const CORE_WASM_URL = `/ffmpeg/${CORE_VERSION}/ffmpeg-core.wasm`

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

// Remembers, per browser, that the core has loaded once. A later visit is
// served from the HTTP cache (immutable header), so the loading label mustn't
// claim a download then. Only a convenience: if storage is blocked, the
// label falls back to the first-visit wording.
export const CORE_SEEN_KEY = `mp3tom4b:ffmpeg-core:${CORE_VERSION}`

function coreSeenBefore(): boolean {
  try {
    return localStorage.getItem(CORE_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function rememberCoreSeen(): void {
  try {
    localStorage.setItem(CORE_SEEN_KEY, '1')
  } catch {
    // storage blocked — label just stays conservative next time
  }
}

// Blob URLs of the core, made once by the singleton and reused by every
// encoder worker instance. The core is single-threaded: it needs neither
// SharedArrayBuffer nor cross-origin isolation, so the site sends no
// COOP/COEP headers and works in in-app browsers too. Encoding still runs in
// parallel, as several instances at once.
let coreBlobURL: string | null = null
let wasmBlobURL: string | null = null

// Active encoder worker instances — terminated on cancel.
const activeWorkers = new Set<FFmpeg>()

// Serialize ffmpeg.load() across worker instances. Concurrent loads can race
// on shared module state inside @ffmpeg/ffmpeg.
let workerLoadLock: Promise<void> = Promise.resolve()

/**
 * Fetch one core file into a blob: URL. A network failure, a blocked request
 * or an HTTP error (fetch doesn't reject on a 404, and a page of HTML would
 * then fail to load as wasm, far from the cause) becomes an EngineLoadError,
 * so every tool can say the engine couldn't be downloaded.
 */
async function coreBlobUrl(url: string, type: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    throw new EngineLoadError(err instanceof Error ? err.message : String(err))
  }
  if (!res.ok) throw new EngineLoadError(`HTTP ${res.status} for ${url}`)
  try {
    return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }))
  } catch (err) {
    // The connection dropped halfway through the download.
    throw new EngineLoadError(err instanceof Error ? err.message : String(err))
  }
}

/**
 * Lazy-load and cache the singleton FFmpeg instance used for concat + mux.
 * A failed load is forgotten, so the next call (a retry) starts over instead
 * of getting the same rejected promise for the rest of the visit.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance
  if (loadPromise) return loadPromise

  const attempt = (async () => {
    if (!coreBlobURL || !wasmBlobURL) {
      ;[coreBlobURL, wasmBlobURL] = await Promise.all([
        coreBlobUrl(CORE_JS_URL, 'text/javascript'),
        coreBlobUrl(CORE_WASM_URL, 'application/wasm'),
      ])
    }
    const ffmpeg = new FFmpeg()
    try {
      await ffmpeg.load({ coreURL: coreBlobURL, wasmURL: wasmBlobURL })
    } catch (err) {
      try {
        ffmpeg.terminate()
      } catch {
        // never started
      }
      throw err
    }

    instance = ffmpeg
    rememberCoreSeen()
    return ffmpeg
  })()
  loadPromise = attempt
  attempt.catch(() => {
    if (loadPromise === attempt) loadPromise = null
  })

  return attempt
}

/**
 * Create a short-lived single-threaded FFmpeg instance for parallel encoding.
 * Loads are serialized internally to avoid race conditions in @ffmpeg/ffmpeg.
 * Call releaseWorkerFFmpeg() when done.
 */
export async function createWorkerFFmpeg(): Promise<FFmpeg> {
  await getFFmpeg() // makes the blob URLs, and keeps cancel/teardown semantics in line

  // Serialize loads so multiple concurrent createWorkerFFmpeg() calls don't
  // step on each other during initialization.
  const previous = workerLoadLock
  let release!: () => void
  workerLoadLock = new Promise<void>((r) => {
    release = r
  })
  try {
    await previous
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({ coreURL: coreBlobURL!, wasmURL: wasmBlobURL! })
    activeWorkers.add(ffmpeg)
    return ffmpeg
  } finally {
    release()
  }
}

/** Terminate a worker instance and remove it from the active set. */
export function releaseWorkerFFmpeg(ffmpeg: FFmpeg): void {
  activeWorkers.delete(ffmpeg)
  try {
    ffmpeg.terminate()
  } catch {
    // ignore
  }
}

export function isFFmpegLoaded(): boolean {
  return instance !== null
}

/**
 * Progress label for the load phase. On a first visit the core is a ~10 MB
 * one-time download, which otherwise looks like an unexplained stall; once it's
 * cached (this tab, or an earlier visit) the same step is quick, so don't
 * claim a download then.
 */
export function ffmpegLoadingLabel(): string {
  return isFFmpegLoaded() || coreSeenBefore() ? 'Loading converter…' : 'Downloading converter (one-time, about 10 MB)…'
}

/**
 * Terminate the singleton and all active worker instances, then reset state
 * so the next getFFmpeg() call starts fresh. Safe to call mid-conversion.
 */
export function terminateFFmpeg(): void {
  if (instance) {
    try {
      instance.terminate()
    } catch {
      // ignore — may already be dead
    }
    instance = null
  }
  activeWorkers.forEach((worker) => {
    try {
      worker.terminate()
    } catch {
      // ignore
    }
  })
  activeWorkers.clear()
  loadPromise = null
}

/**
 * After a run that failed (not a cancel): start the next one on a fresh
 * engine. A run that died, out of memory or trapped, leaves its allocations
 * in the wasm heap, which never shrinks, and can leave mounts and files
 * behind, so a retry on the same instance starts with less memory or fails at
 * once (seen in the field: a second attempt failing after 0 s). The core
 * stays cached, so the reload takes about a second.
 */
export function resetFFmpegAfterFailure(): void {
  terminateFFmpeg()
}
