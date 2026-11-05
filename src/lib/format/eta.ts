/** A point in a job's progress: when, and how much of it was done (0–1). */
export interface ProgressPoint {
  ms: number
  fraction: number
}

/** With less measured than this, the pace says too little to project from. */
export const MIN_MEASURED_MS = 8000

/**
 * Time left at `nowMs`, from the average pace between `start` and the latest
 * `sample`. The average over the whole step, not over the last few updates:
 * those swing with whichever chapters happen to finish (an estimate jumping
 * from 11 minutes to an hour), the whole step doesn't. Measured from the
 * sample, so it counts down between updates. null while there's too little
 * to go on, or when the step is all but done.
 */
export function projectRemainingMs(start: ProgressPoint, sample: ProgressPoint, nowMs: number): number | null {
  const measured = sample.ms - start.ms
  const done = sample.fraction - start.fraction
  if (measured < MIN_MEASURED_MS || done < 0.01 || sample.fraction >= 0.99) return null
  return Math.max(0, ((1 - sample.fraction) * measured) / done - (nowMs - sample.ms))
}

/** "~3m 0s remaining". null under 5 s, where it would only flicker. */
export function formatRemaining(ms: number): string | null {
  if (!Number.isFinite(ms)) return null
  const remainingS = Math.round(ms / 1000)
  if (remainingS < 5) return null
  if (remainingS < 60) return `~${remainingS}s remaining`

  const m = Math.floor(remainingS / 60)
  const s = remainingS % 60
  if (m < 60) return `~${m}m ${s}s remaining`

  const h = Math.floor(m / 60)
  const remM = m % 60
  return `~${h}h ${remM}m remaining`
}
