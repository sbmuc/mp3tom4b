'use client'

import { useEffect, useRef, useState } from 'react'
import { formatRemaining, projectRemainingMs, type ProgressPoint } from '@/lib/format/eta'

/**
 * "Time left" for a long-running step, from the average pace since it started
 * moving (see projectRemainingMs), refreshed every second so it counts down
 * between progress updates instead of standing still and then jumping.
 *
 * `fraction` is the step's progress (0–1); when `active` goes false (done,
 * cancelled, failed) the estimate is cleared. `projectedMs`, when the step
 * knows better (the converter plays out its queue of files), is used instead
 * and counted down the same way. Returns null until there is enough to go
 * on; callers then render nothing.
 */
export function useEta(fraction: number, active: boolean, projectedMs?: number): string | null {
  const [eta, setEta] = useState<string | null>(null)
  const startRef = useRef<ProgressPoint | null>(null)
  const sampleRef = useRef<ProgressPoint | null>(null)
  const movingRef = useRef(false)
  const projectedRef = useRef<{ ms: number; remainingMs: number } | null>(null)

  useEffect(() => {
    projectedRef.current = active && projectedMs != null ? { ms: Date.now(), remainingMs: projectedMs } : null
  }, [projectedMs, active])

  useEffect(() => {
    if (!active) {
      startRef.current = null
      sampleRef.current = null
      movingRef.current = false
      return
    }
    const point = { ms: Date.now(), fraction: Math.max(0, Math.min(1, fraction)) }
    const start = startRef.current
    if (!start) {
      startRef.current = point
      return
    }
    if (point.fraction <= (sampleRef.current ?? start).fraction) return
    // The clock starts at the first movement: loading the engine or reading
    // the input before it isn't slow progress.
    if (!movingRef.current) {
      movingRef.current = true
      startRef.current = point
      return
    }
    sampleRef.current = point
  }, [fraction, active])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const now = Date.now()
      const projected = projectedRef.current
      const start = startRef.current
      const sample = sampleRef.current
      const ms = projected
        ? Math.max(0, projected.remainingMs - (now - projected.ms))
        : start && sample
          ? projectRemainingMs(start, sample, now)
          : null
      setEta(ms == null ? null : formatRemaining(ms))
    }, 1000)
    return () => {
      clearInterval(id)
      setEta(null)
    }
  }, [active])

  return eta
}
