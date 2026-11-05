import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', () => ({}))

import { encodeWeights, simulateEncodeMs } from '@/lib/ffmpeg/convert'

describe('encodeWeights', () => {
  it('weighs each file by its length', () => {
    // A 27-minute chapter and an 11.5-hour file: the long one is 25× the work.
    const [chapter, book] = encodeWeights([27 * 60, 690 * 60])
    expect(book / chapter).toBeCloseTo(25.6, 1)
  })

  it('counts a file of unknown length as an average one', () => {
    expect(encodeWeights([100, null, 300, 0])).toEqual([100, 200, 300, 200])
    expect(encodeWeights([null, null])).toEqual([1, 1])
  })
})

describe('simulateEncodeMs', () => {
  it('sees the tail coming when one long file is left for one worker', () => {
    // 3 workers, 1 ms per audio second. Short files finish fast, then one
    // worker alone takes the 600 s file: 610 ms, not (total work / 3).
    const ms = simulateEncodeMs({ active: [10, 10, 10], queued: [10, 10, 600], workers: 3, msPerAudioSec: 1 })
    expect(ms).toBe(610)
    const naive = (10 * 5 + 600) / 3
    expect(ms).toBeGreaterThan(naive * 2.5)
  })

  it('spreads even files over the workers', () => {
    expect(simulateEncodeMs({ active: [5, 5, 5], queued: [5, 5, 5], workers: 3, msPerAudioSec: 2 })).toBe(20)
  })

  it('uses idle workers for the queue', () => {
    expect(simulateEncodeMs({ active: [30], queued: [10, 10], workers: 3, msPerAudioSec: 1 })).toBe(30)
    expect(simulateEncodeMs({ active: [], queued: [], workers: 3, msPerAudioSec: 1 })).toBe(0)
  })
})
