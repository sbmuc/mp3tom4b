// @vitest-environment node
/**
 * End-to-end check of the homepage converter: real convertToM4B, real
 * ffmpeg-core, real music-metadata — only the browser worker is swapped for an
 * in-process core (nodeFFmpeg.ts). See helpers.ts for how outputs are checked.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Bitrate, ConversionMetadata } from '@/types'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { convertToM4B } from '@/lib/ffmpeg/convert'
import {
  META,
  TEN_ODD_CHAPTERS,
  analyze,
  asAudioFile,
  expectAppleDecodes,
  expectChaptersMatchAudio,
  mp3,
  toneFile,
  total,
  type ToneSpec,
} from './helpers'

async function convert(specs: ToneSpec[], opts: { bitrate?: Bitrate; metadata?: Partial<ConversionMetadata> } = {}) {
  const files = await Promise.all(specs.map(async (s, i) => asAudioFile(await toneFile(s), i)))
  const labels: string[] = []
  const blob = await convertToM4B({
    files,
    metadata: { ...META, ...opts.metadata },
    coverFile: null,
    bitrate: opts.bitrate ?? 64,
    onProgress: (p) => labels.push(p.label),
  })
  return { out: new Uint8Array(await blob.arrayBuffer()), labels, files }
}

// ---- cases ---------------------------------------------------------------

describe('convertToM4B — joining different sources', () => {
  it('uniform MP3s (one rip, one encoder)', async () => {
    const specs = [mp3(440), mp3(880), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expect(a.stream).toMatch(/44100 Hz, stereo/)
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('one chapter at 48 kHz among 44.1 kHz — no pitch shift', async () => {
    const specs = [mp3(440), mp3(880, 48000), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expect(a.stream).toMatch(/48000 Hz, stereo/)
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('one mono chapter among stereo — Apple can still read it', async () => {
    const specs = [mp3(440), mp3(880, 44100, 1), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('old rip mixed with a new one: 22 kHz mono + 44.1 kHz stereo, MP3 + WAV', async () => {
    const specs: ToneSpec[] = [mp3(440, 22050, 1), { hz: 880, sec: 3, rate: 44100, channels: 2, format: 'wav' }, mp3(660, 22050, 1)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('an all-mono set stays mono', async () => {
    const specs = [mp3(440, 22050, 1), mp3(880, 22050, 1)]
    const a = await analyze((await convert(specs)).out)
    expect(a.stream).toMatch(/22050 Hz, mono/)
  })
})

describe('convertToM4B — chapter markers', () => {
  it('stay on the audio across 10 chapters of odd lengths (no drift)', async () => {
    const specs = TEN_ODD_CHAPTERS
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expect(a.chapters.map((c) => c.title)).toEqual(specs.map((_, i) => `Chapter ${i + 1}`))
    expectAppleDecodes(out, total(specs))
  })
})

describe('convertToM4B — metadata', () => {
  it('keeps a backslash, semicolon and equals sign in the book title', async () => {
    const { out } = await convert([mp3(440, 44100, 2, 1)], {
      metadata: { title: 'AC\\DC Live; Part=1', author: 'Guns N\' Roses #1', narrator: 'A \\ B' },
    })
    const a = await analyze(out)
    expect(a.tags.title).toBe('AC\\DC Live; Part=1')
    expect(a.tags.album).toBe('AC\\DC Live; Part=1')
    expect(a.tags.artist).toBe('Guns N\' Roses #1')
    expect(a.tags.composer).toBe('A \\ B')
  })
})

describe('convertToM4B — AAC .m4a inputs', () => {
  const m4a = (hz: number, kbps: number, channels: 1 | 2 = 2): ToneSpec => ({ hz, sec: 3, rate: 44100, channels, format: 'm4a', kbps })

  it('copies matching AAC at the chosen bitrate instead of re-encoding', async () => {
    const specs = [m4a(440, 64), m4a(880, 64), m4a(660, 64)]
    const { out, labels } = await convert(specs, { bitrate: 64 })
    expect(labels.some((l) => l.startsWith('Copying chapters'))).toBe(true)
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(false)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('re-encodes mono + stereo AAC even though the tags claim both are stereo', async () => {
    const specs = [m4a(440, 64), m4a(880, 64, 1), m4a(660, 64)]
    const { out, labels, files } = await convert(specs, { bitrate: 64 })
    expect(files[1].sourceChannels).toBe(2) // the music-metadata quirk this guards against
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(true)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('re-encodes AAC above the chosen bitrate, so the size estimate holds', async () => {
    const specs = [m4a(440, 160), m4a(880, 160)]
    const { out, labels } = await convert(specs, { bitrate: 64 })
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(true)
    // 6 s at 64 kbps ≈ 48 KB of audio; the 160 kbps sources are ~120 KB
    expect(out.byteLength).toBeLessThan(75_000)
  })
})
