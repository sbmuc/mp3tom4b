import type { ShortChapter } from '@/types'

/**
 * Sharing long files between the encoder workers, and spotting chapters that
 * came out short. Pure + unit-testable; convert.ts runs it.
 *
 * The converter encodes each file on its own worker, so a book that is one
 * long file used one core while the others sat idle (1 hour took 22 s where
 * Add chapters, which splits, took 7). A long file is now cut into pieces,
 * one per worker. Each piece is encoded on its own, and every join between
 * pieces adds about 30 ms of near-silence (the encoder's start-up frame, which
 * a copy-join can't remove), so the cuts go in the middle of a pause, where
 * nothing is said. No pause near a cut: no cut there.
 */

/** Files up to this long are never cut: too short to be worth a join. */
export const MIN_SPLIT_SEC = 20 * 60
/** No piece shorter than this. */
const MIN_PIECE_SEC = 60
/** How far from the even split a pause may be (and never more than half a piece). */
const MAX_REACH_SEC = 5 * 60

/** A pause to cut in: at least this long, at least this quiet. */
export const SPLIT_PAUSE = { minSec: 0.4, noiseDb: -35 }

/** ffmpeg args for the pause scan of one file (a decode pass, no output). */
export function pauseScanArgs(input: string): string[] {
  return [
    '-hide_banner', '-v', 'info', '-i', input, '-vn',
    '-af', `silencedetect=noise=${SPLIT_PAUSE.noiseDb}dB:d=${SPLIT_PAUSE.minSec}`,
    '-f', 'null', '-',
  ]
}

/**
 * How many pieces each file should be cut into. A file gets cut only when it
 * is long next to the whole book: pieces of about the book's length divided
 * by the workers (and at least MIN_SPLIT_SEC), at most one per worker. A
 * book of many short files stays as it is; one 11-hour file in a book of 40
 * short ones is cut in two or three.
 */
export function piecesPerFile(durationsSec: Array<number | null>, workers: number): number[] {
  const known = durationsSec.map((d) => (d != null && Number.isFinite(d) && d > 0 ? d : 0))
  if (workers < 2) return known.map(() => 1)
  const total = known.reduce((a, b) => a + b, 0)
  const target = Math.max(MIN_SPLIT_SEC, total / workers)
  return known.map((d) => (d > MIN_SPLIT_SEC ? Math.min(workers, Math.ceil(d / target)) : 1))
}

/**
 * Where to cut a file of `durationSec` into `pieces`: at the middle of the
 * pause nearest each even split point. A split point with no pause within
 * reach is skipped, so the file gets fewer, longer pieces rather than a join
 * in the middle of a word. Returns the cut times in seconds, increasing.
 */
export function pickCuts(
  durationSec: number,
  pieces: number,
  pauses: Array<{ startMs: number; endMs: number }>,
): number[] {
  if (pieces < 2 || durationSec <= 0) return []
  const reach = Math.min(MAX_REACH_SEC, durationSec / pieces / 2)
  const mids = pauses
    .map((p) => (p.startMs + p.endMs) / 2000)
    .filter((m) => Number.isFinite(m))
    .sort((a, b) => a - b)
  const cuts: number[] = []
  let last = 0
  for (let k = 1; k < pieces; k++) {
    const ideal = (durationSec * k) / pieces
    let best: number | null = null
    for (const mid of mids) {
      if (mid < last + MIN_PIECE_SEC || mid > durationSec - MIN_PIECE_SEC) continue
      const off = Math.abs(mid - ideal)
      if (off <= reach && (best == null || off < Math.abs(best - ideal))) best = mid
    }
    if (best != null) {
      cuts.push(best)
      last = best
    }
  }
  return cuts
}

/** One stretch of one file, encoded by one worker. */
export interface EncodeJob {
  /** Index of the file in the book. */
  file: number
  startSec: number
  /** Null: to the end of the file. */
  endSec: number | null
  /** Its length in seconds (how much it counts for progress and time left). */
  weight: number
  /** Whether the file is cut: the job then trims its stretch out of the decode. */
  trimmed: boolean
}

/**
 * The encode jobs for the book, in book order: one per uncut file, one per
 * piece of a cut one. `cutsPerFile[i]` are file i's cut times (empty: uncut);
 * `weights[i]` its length for progress.
 */
export function buildJobs(weights: number[], cutsPerFile: number[][]): EncodeJob[] {
  const jobs: EncodeJob[] = []
  weights.forEach((weight, file) => {
    const cuts = cutsPerFile[file] ?? []
    if (cuts.length === 0) {
      jobs.push({ file, startSec: 0, endSec: null, weight, trimmed: false })
      return
    }
    const edges = [0, ...cuts]
    edges.forEach((start, k) => {
      const end = k < cuts.length ? cuts[k] : null
      jobs.push({ file, startSec: start, endSec: end, weight: (end ?? weight) - start, trimmed: true })
    })
  })
  return jobs
}

/** Shorter than this share of its file, and by at least MIN_SHORT_SEC, is suspicious. */
const SHORT_SHARE = 0.9
const MIN_SHORT_SEC = 3

/**
 * Chapters whose encoded audio is much shorter than the file said it was. A
 * partly damaged MP3 converts without an error: ffmpeg skips what it can't
 * decode, and a 30-second file came out as a 15-second chapter, unnoticed.
 * A file whose length isn't known on either side is left out.
 */
export function findShortChapters(
  chapters: Array<{ title: string; expectedSec: number | null; gotSec: number | null }>,
): ShortChapter[] {
  return chapters
    .filter(
      (c): c is { title: string; expectedSec: number; gotSec: number } =>
        c.expectedSec != null &&
        c.gotSec != null &&
        c.expectedSec - c.gotSec >= MIN_SHORT_SEC &&
        c.gotSec < c.expectedSec * SHORT_SHARE,
    )
    .map(({ title, expectedSec, gotSec }) => ({ title, expectedSec, gotSec }))
}
