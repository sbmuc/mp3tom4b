import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORE_SEEN_KEY, ffmpegLoadingLabel } from '@/lib/ffmpeg/client'

// Node 25's own (flag-gated) localStorage global shadows happy-dom's, so give
// the module a plain in-memory Storage.
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('ffmpegLoadingLabel', () => {
  it('names the one-time download on a first visit', () => {
    expect(ffmpegLoadingLabel()).toBe('Downloading converter (one-time, ~31 MB)…')
  })

  it('does not claim a download once the core has loaded in an earlier visit', () => {
    localStorage.setItem(CORE_SEEN_KEY, '1')
    expect(ffmpegLoadingLabel()).toBe('Loading converter…')
  })

  it('falls back to the first-visit wording when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(ffmpegLoadingLabel()).toBe('Downloading converter (one-time, ~31 MB)…')
  })

  it('ties the memory to the core version, so an upgrade counts as a new download', () => {
    expect(CORE_SEEN_KEY).toMatch(/0\.12\.6$/)
  })
})
