import { describe, expect, it } from 'vitest'
import { formatRemaining, projectRemainingMs } from '@/lib/format/eta'

describe('formatRemaining', () => {
  it('returns null under 5 s, where it would only flicker', () => {
    expect(formatRemaining(4_000)).toBeNull()
    expect(formatRemaining(Number.NaN)).toBeNull()
  })

  it('formats seconds, minutes and hours', () => {
    expect(formatRemaining(40_000)).toBe('~40s remaining')
    expect(formatRemaining(180_000)).toBe('~3m 0s remaining')
    expect(formatRemaining(400_000)).toBe('~6m 40s remaining')
    expect(formatRemaining(220 * 60_000)).toBe('~3h 40m remaining')
  })
})

describe('projectRemainingMs', () => {
  const start = { ms: 0, fraction: 0 }

  it('projects from the average pace since the start', () => {
    // A quarter done in 60 s: three quarters (180 s) to go.
    expect(projectRemainingMs(start, { ms: 60_000, fraction: 0.25 }, 60_000)).toBe(180_000)
    // Measured from a later start point, its own pace counts.
    expect(projectRemainingMs({ ms: 10_000, fraction: 0.1 }, { ms: 70_000, fraction: 0.4 }, 70_000)).toBeCloseTo(120_000)
  })

  it('counts down between updates instead of standing still', () => {
    const sample = { ms: 60_000, fraction: 0.25 }
    expect(projectRemainingMs(start, sample, 90_000)).toBe(150_000)
    expect(projectRemainingMs(start, sample, 300_000)).toBe(0)
  })

  it('waits until there is something to go on, and stops near the end', () => {
    expect(projectRemainingMs(start, { ms: 5_000, fraction: 0.2 }, 5_000)).toBeNull() // under 8 s measured
    expect(projectRemainingMs(start, { ms: 60_000, fraction: 0.005 }, 60_000)).toBeNull() // hardly moved
    expect(projectRemainingMs(start, { ms: 60_000, fraction: 0.995 }, 60_000)).toBeNull() // all but done
  })

  it("doesn't swing with how one stretch went", () => {
    // Steady pace overall, one slow stretch at the end: the estimate stays
    // near the true 200 s left instead of jumping to the slow stretch's pace.
    const before = projectRemainingMs(start, { ms: 100_000, fraction: 0.5 }, 100_000)
    const afterSlowStretch = projectRemainingMs(start, { ms: 120_000, fraction: 0.52 }, 120_000)
    expect(before).toBe(100_000)
    expect(afterSlowStretch).toBeGreaterThan(100_000)
    expect(afterSlowStretch).toBeLessThan(115_000)
  })
})
