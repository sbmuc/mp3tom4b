'use client'

import { useEffect, useRef, useState } from 'react'
import { formatEta } from '@/lib/format/eta'

const WINDOW = 6
const MIN_ELAPSED_MS = 8000

/**
 * Rolling-window "time remaining" for a long-running job.
 *
 * Projects from the recent rate of progress rather than the average since the
 * start, so a slow warm-up (loading ffmpeg, probing) doesn't skew the estimate.
 * Returns null until there is enough data to project meaningfully — callers
 * simply render nothing in that case.
 *
 * `percent` is the job's overall 0–100 progress; `active` resets the projection
 * when it goes false (job finished, cancelled, or errored).
 */
export function useEta(percent: number, active: boolean): string | null {
  const [eta, setEta] = useState<string | null>(null)
  const startRef = useRef<number | null>(null)
  const samplesRef = useRef<[number, number][]>([])

  useEffect(() => {
    if (!active) {
      startRef.current = null
      samplesRef.current = []
      setEta(null)
      return
    }

    const now = Date.now()
    if (startRef.current == null) {
      startRef.current = now
      samplesRef.current = []
    }

    const pct = Math.max(0, Math.min(100, percent))
    const samples = samplesRef.current
    samples.push([now, pct])
    if (samples.length > WINDOW) samples.shift()

    if (samples.length < 2 || now - startRef.current < MIN_ELAPSED_MS) {
      setEta(null)
      return
    }

    // Smoothed rate over the window's oldest sample.
    const [oldestMs, oldestPct] = samples[0]
    const windowElapsed = now - oldestMs
    const windowProgress = pct - oldestPct
    if (windowElapsed <= 0 || windowProgress <= 0) {
      setEta(null)
      return
    }

    // formatEta expects (elapsed, percent) — synthesise a linear pair that
    // yields the same remaining time as (100 - pct) * msPerPct.
    const msPerPct = windowElapsed / windowProgress
    setEta(formatEta(pct * msPerPct, pct))
  }, [percent, active])

  return eta
}
