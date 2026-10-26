'use client'

import { createWorkerFFmpeg, releaseWorkerFFmpeg } from './client'
import { mountBlobs, takeBytes, unmount } from './files'
import { decodedAudioSeconds } from './mp4Duration'

const SOURCE_DIR = '/mnt_segment'

/** How many segments to encode in parallel — scales with CPU, capped at 3. */
export function encodeConcurrency(count: number): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  return Math.min(3, count, Math.max(1, Math.floor(cores / 2)))
}

/**
 * Re-encode split segments across a pool of worker instances. Each worker
 * mounts its segment (never copied in), encodes it, and hands the result back
 * as a Blob. Returns the encoded parts and each part's decoded length in
 * seconds (null if unreadable). `onProgress` gets the summed per-segment
 * progress (0..count) and how many segments are done.
 */
export async function encodeSegmentsInWorkers(
  segments: Blob[],
  o: {
    ext: string
    args: (input: string, output: string) => string[]
    onProgress: (progressSum: number, completed: number) => void
  },
): Promise<{ parts: Blob[]; decodedSec: Array<number | null> }> {
  const count = segments.length
  const parts = new Array<Blob>(count)
  const decodedSec = new Array<number | null>(count).fill(null)
  const perSeg = new Array<number>(count).fill(0)
  let completed = 0
  const report = () => o.onProgress(perSeg.reduce((a, b) => a + b, 0), completed)

  const queue = Array.from({ length: count }, (_, i) => i)

  async function runWorker() {
    const worker = await createWorkerFFmpeg()
    try {
      while (true) {
        const idx = queue.shift()
        if (idx === undefined) break

        const input = `in_${idx}.${o.ext}`
        const output = `out_${idx}.m4a`
        const onProg = ({ progress }: { progress: number }) => {
          perSeg[idx] = Math.max(0, Math.min(1, progress))
          report()
        }
        worker.on('progress', onProg)
        try {
          await mountBlobs(worker, SOURCE_DIR, [{ name: input, data: segments[idx] }])
          try {
            await worker.exec(o.args(`${SOURCE_DIR}/${input}`, output))
          } finally {
            await unmount(worker, SOURCE_DIR)
          }
          const bytes = await takeBytes(worker, output)
          decodedSec[idx] = decodedAudioSeconds(bytes)
          parts[idx] = new Blob([bytes], { type: 'audio/mp4' })
        } finally {
          worker.off('progress', onProg)
          perSeg[idx] = 1
          completed++
          report()
        }
      }
    } finally {
      releaseWorkerFFmpeg(worker)
    }
  }

  await Promise.all(Array.from({ length: encodeConcurrency(count) }, () => runWorker()))
  return { parts, decodedSec }
}
