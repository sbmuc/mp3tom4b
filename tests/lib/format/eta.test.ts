import { describe, expect, it } from 'vitest'
import { formatEta } from '@/lib/format/eta'

describe('formatEta', () => {
  it('returns null below the 12% confidence threshold', () => {
    expect(formatEta(1000, 0)).toBeNull()
    expect(formatEta(1000, 5)).toBeNull()
    expect(formatEta(1000, 11.9)).toBeNull()
  })

  it('returns null at or above 99% (long-tail finalize)', () => {
    expect(formatEta(60_000, 99)).toBeNull()
    expect(formatEta(60_000, 99.5)).toBeNull()
    expect(formatEta(60_000, 100)).toBeNull()
  })

  it('returns null for non-positive elapsed time', () => {
    expect(formatEta(0, 50)).toBeNull()
    expect(formatEta(-1, 50)).toBeNull()
  })

  it('returns null when projected remaining is under 5s', () => {
    // 95% in 95s → ETA ≈ 5s, exactly at the cutoff. Use 96% so it's < 5s.
    expect(formatEta(96_000, 96)).toBeNull()
  })

  it('formats sub-minute estimates as seconds', () => {
    // 20% in 10s → total 50s, remaining 40s
    expect(formatEta(10_000, 20)).toBe('~40s remaining')
  })

  it('formats sub-hour estimates as minutes + seconds', () => {
    // 25% in 60s → total 240s, remaining 180s = 3m 0s
    expect(formatEta(60_000, 25)).toBe('~3m 0s remaining')
    // 20% in 100s → total 500s, remaining 400s = 6m 40s
    expect(formatEta(100_000, 20)).toBe('~6m 40s remaining')
  })

  it('formats multi-hour estimates as hours + minutes', () => {
    // 12% in 30 min → total 250 min, remaining 220 min = 3h 40m
    expect(formatEta(30 * 60 * 1000, 12)).toBe('~3h 40m remaining')
  })
})
