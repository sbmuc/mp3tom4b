'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

const CORE_VERSION = '0.12.6'
const MT_BASE_URL = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`
const ST_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`

let instance: FFmpeg | null = null
let loadPromise: Promise<FFmpeg> | null = null

// Single-threaded blob URLs — used for parallel encoder worker instances
// regardless of whether the singleton is MT. Multiple MT instances conflict
// over their pthread pools (each spawns its own pool against shared
// SharedArrayBuffer state) which causes loads or execs to fail. Workers run
// on the ST core for reliability; we still get parallelism by running
// multiple ST instances at once.
let stCoreURL: string | null = null
let stWasmURL: string | null = null
let stLoadPromise: Promise<void> | null = null

// Active encoder worker instances — terminated on cancel.
const activeWorkers = new Set<FFmpeg>()

// Serialize ffmpeg.load() across worker instances. Concurrent loads can race
// on shared module state inside @ffmpeg/ffmpeg.
let workerLoadLock: Promise<void> = Promise.resolve()

/**
 * Multi-threaded ffmpeg.wasm is currently disabled. Running an MT instance
 * alongside ST worker instances (used for parallel encoding) corrupts the
 * shared wasm heap and crashes with "RuntimeError: memory access out of
 * bounds". With parallel ST workers we already saturate available cores via
 * separate instances, so we lose nothing by going all-ST — and we save the
 * ~30MB MT core download.
 *
 * Re-enable only if parallel encoding is removed or if @ffmpeg/ffmpeg gains
 * proper isolation between MT and ST instances in the same page.
 */
function canUseMultiThreaded(): boolean {
  return false
}

/**
 * Lazy-load and cache the singleton FFmpeg instance used for concat + mux.
 * Uses the multi-threaded core when possible, single-threaded otherwise.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg()
    const useMt = canUseMultiThreaded()
    const baseUrl = useMt ? MT_BASE_URL : ST_BASE_URL

    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${baseUrl}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${baseUrl}/ffmpeg-core.wasm`, 'application/wasm'),
    ])

    if (useMt) {
      const workerURL = await toBlobURL(`${baseUrl}/ffmpeg-core.worker.js`, 'text/javascript')
      await ffmpeg.load({ coreURL, wasmURL, workerURL })
    } else {
      // When MT isn't available, the singleton is ST — reuse its blobs for workers.
      stCoreURL = coreURL
      stWasmURL = wasmURL
      await ffmpeg.load({ coreURL, wasmURL })
    }

    instance = ffmpeg
    return ffmpeg
  })()

  return loadPromise
}

/**
 * Lazy-load the single-threaded core blob URLs. Idempotent and safe to call
 * concurrently from multiple workers — only the first call does the work.
 */
async function ensureStBlobs(): Promise<void> {
  if (stCoreURL && stWasmURL) return
  if (stLoadPromise) return stLoadPromise
  stLoadPromise = (async () => {
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${ST_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${ST_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    ])
    stCoreURL = coreURL
    stWasmURL = wasmURL
  })()
  return stLoadPromise
}

/**
 * Create a short-lived single-threaded FFmpeg instance for parallel encoding.
 * Loads are serialized internally to avoid race conditions in @ffmpeg/ffmpeg.
 * Call releaseWorkerFFmpeg() when done.
 */
export async function createWorkerFFmpeg(): Promise<FFmpeg> {
  await getFFmpeg() // ensure singleton is up so cancel/teardown semantics line up
  await ensureStBlobs()

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
    await ffmpeg.load({ coreURL: stCoreURL!, wasmURL: stWasmURL! })
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
