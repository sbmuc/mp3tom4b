import { describe, expect, it } from 'vitest'
import {
  estimateOutputBytes,
  formatEstimatedSize,
  suggestBitrate,
} from '@/lib/audio/bitrate'

describe('suggestBitrate', () => {
  it('returns 64 when no files are present', () => {
    expect(suggestBitrate({ files: [], genre: 'Audiobook' })).toBe(64)
    expect(suggestBitrate({ files: [], genre: 'Podcast' })).toBe(64)
  })

  it('returns 64 for low-bitrate spoken-word inputs regardless of genre', () => {
    const files = [{ sourceBitrateKbps: 32 }, { sourceBitrateKbps: 64 }]
    expect(suggestBitrate({ files, genre: 'Audiobook' })).toBe(64)
    expect(suggestBitrate({ files, genre: 'Podcast' })).toBe(64)
  })

  it('keeps 64 for lossless source when genre is Audiobook (spoken word does not need bumping)', () => {
    const files = [{ sourceLossless: true }]
    expect(suggestBitrate({ files, genre: 'Audiobook' })).toBe(64)
  })

  it('bumps to 96 for lossless source on non-audiobook genres', () => {
    const files = [{ sourceLossless: true, sourceBitrateKbps: 1411 }]
    expect(suggestBitrate({ files, genre: 'Podcast' })).toBe(96)
    expect(suggestBitrate({ files, genre: 'Lecture' })).toBe(96)
    expect(suggestBitrate({ files, genre: 'Other' })).toBe(96)
  })

  it('bumps to 96 when any source is above 256 kbps and genre is not Audiobook', () => {
    const files = [{ sourceBitrateKbps: 128 }, { sourceBitrateKbps: 320 }]
    expect(suggestBitrate({ files, genre: 'Other' })).toBe(96)
  })

  it('does not bump when sources are exactly at 256 kbps', () => {
    const files = [{ sourceBitrateKbps: 256 }]
    expect(suggestBitrate({ files, genre: 'Other' })).toBe(64)
  })
})

describe('estimateOutputBytes', () => {
  it('returns 0 for non-positive duration', () => {
    expect(estimateOutputBytes(0, 64)).toBe(0)
    expect(estimateOutputBytes(-10, 64)).toBe(0)
  })

  it('computes bytes as bitrate × duration / 8', () => {
    // 64 kbps × 60 s = 3,840,000 bits = 480,000 bytes
    expect(estimateOutputBytes(60, 64)).toBe(480_000)
    // 128 kbps × 3600 s = 460,800,000 bits = 57,600,000 bytes
    expect(estimateOutputBytes(3600, 128)).toBe(57_600_000)
  })
})

describe('formatEstimatedSize', () => {
  it('returns empty string for non-positive bytes', () => {
    expect(formatEstimatedSize(0)).toBe('')
    expect(formatEstimatedSize(-1)).toBe('')
  })

  it('shows KB under 1 MB', () => {
    expect(formatEstimatedSize(500_000)).toBe('~488 KB')
  })

  it('shows MB between 1 MB and 1 GB', () => {
    expect(formatEstimatedSize(57_600_000)).toBe('~55 MB')
  })

  it('shows GB above 1 GB', () => {
    expect(formatEstimatedSize(2 * 1024 * 1024 * 1024)).toBe('~2.0 GB')
  })
})
