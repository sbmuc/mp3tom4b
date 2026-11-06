import { describe, expect, it } from 'vitest'
import {
  aacCeilingKbps,
  bitrateAdvice,
  effectiveKbps,
  estimateOutputBytes,
  formatEstimatedSize,
  LIKELY_TOO_BIG_BYTES,
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

describe('what the encoder reaches', () => {
  it('tops out by sample rate, whatever the setting', () => {
    expect(aacCeilingKbps({ sampleRate: 22050, channels: 2 })).toBe(112)
    expect(aacCeilingKbps({ sampleRate: 44100, channels: 1 })).toBe(202)
    expect(effectiveKbps(256, { sampleRate: 22050, channels: 2 })).toBe(112)
    expect(effectiveKbps(64, { sampleRate: 22050, channels: 2 })).toBe(64)
    expect(effectiveKbps(256, { sampleRate: 48000, channels: 2 })).toBe(243)
  })
})

describe('bitrateAdvice', () => {
  const mp3 = (kbps: number, rate = 44100, ch: 1 | 2 = 2) => ({ sourceBitrateKbps: kbps, sourceLossless: false, sourceSampleRate: rate, sourceChannels: ch })

  it('says nothing when the setting suits the files', () => {
    expect(bitrateAdvice(64, [mp3(64), mp3(64)])).toBeNull()
    expect(bitrateAdvice(128, [mp3(128)])).toBeNull()
    expect(bitrateAdvice(256, [])).toBeNull()
  })

  it('says when the files hold less than the setting', () => {
    // The owner's case: 64 kbps MP3s converted at 256.
    expect(bitrateAdvice(256, [mp3(64), mp3(64)])).toEqual({ reason: 'source', enough: 64, sourceKbps: 64 })
    // Mixed: the highest file counts; a little above an option rounds up to the next.
    expect(bitrateAdvice(192, [mp3(32), mp3(80)])).toEqual({ reason: 'source', enough: 96, sourceKbps: 80 })
  })

  it('says when the sample rate caps the encoder', () => {
    // Lossless at 22 kHz: the file isn't the limit, the encoder is (~112 kbps).
    const wav = { sourceBitrateKbps: 706, sourceLossless: true, sourceSampleRate: 22050, sourceChannels: 2 as const }
    expect(bitrateAdvice(256, [wav])).toEqual({ reason: 'sample_rate', enough: 128, sampleRate: 22050, ceilingKbps: 112 })
    expect(bitrateAdvice(128, [wav])).toBeNull()
  })

  it('names the tighter limit when both apply', () => {
    // 32 kbps MP3s at 22 kHz: the files (64 is enough) before the encoder (128).
    expect(bitrateAdvice(256, [mp3(32, 22050, 1)])?.reason).toBe('source')
  })

  it("judges by the sample rate alone when a file's bitrate isn't known", () => {
    const unknown = (rate: number) => ({ sourceBitrateKbps: undefined, sourceLossless: false, sourceSampleRate: rate, sourceChannels: 2 as const })
    expect(bitrateAdvice(256, [unknown(22050)])?.reason).toBe('sample_rate')
    // At 44.1 kHz stereo 256 still gives a little more than 192 (~223 kbps).
    expect(bitrateAdvice(256, [unknown(44100)])).toBeNull()
  })
})

describe('LIKELY_TOO_BIG_BYTES', () => {
  it('sits between what worked (2.0 GB) and what failed (~3.8 GB)', () => {
    const gb = 1024 * 1024 * 1024
    // 41 h at 256 kbps on 44.1 kHz stereo (~223 kbps out): the ~3.8 GB that failed.
    expect(estimateOutputBytes(41 * 3600, 223)).toBeGreaterThan(LIKELY_TOO_BIG_BYTES)
    // 50 h at ~89 kbps: the 1.87 GB book that came together.
    expect(1.87 * gb).toBeLessThan(LIKELY_TOO_BIG_BYTES)
  })
})
