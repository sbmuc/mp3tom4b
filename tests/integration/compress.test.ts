// @vitest-environment node
/**
 * The M4B compressor's parallel path (split at chapters → re-encode pieces in
 * workers → join) against the real ffmpeg-core. The source is a correctly
 * chaptered M4B made by the converter; after compressing, every chapter marker
 * must still sit on the start of its chapter's audio.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { compressM4B } from '@/lib/ffmpeg/compress'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import {
  META,
  TEN_ODD_CHAPTERS,
  analyze,
  asAudioFile,
  expectAppleDecodes,
  expectChaptersMatchAudio,
  toneFile,
  total,
} from './helpers'

// The parallel path only runs with more than one worker; pin the core count so
// the test exercises it on any machine.
beforeAll(() => {
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
})

// Each cut costs a fixed lead (see expectChaptersMatchAudio); what matters is
// that it doesn't grow and the marker never lands after the sound.
const SPLIT_LEAD_MS = 130

describe('compressM4B — parallel path', () => {
  it('keeps every chapter marker on its audio, and keeps titles and tags', async () => {
    const specs = TEN_ODD_CHAPTERS
    const files = await Promise.all(specs.map(async (s, i) => asAudioFile(await toneFile(s), i)))
    const source = await convertToM4B({
      files,
      metadata: { ...META, title: 'AC\\DC Live; Part=1' },
      coverFile: null,
      bitrate: 128,
    })

    // Compressing re-encodes the source, so compare against the source's own
    // length (it is already a little longer than the tones: one encode stage).
    const src = await analyze(new Uint8Array(await source.arrayBuffer()))
    const sourceSec = src.pcm.length / src.rate

    const labels: string[] = []
    const blob = await compressM4B({
      file: new File([source], 'book.m4b'),
      bitrate: 64,
      hasCover: false,
      durationMs: total(specs) * 1000,
      onProgress: (p) => labels.push(p.label),
    })
    expect(labels.some((l) => l.startsWith('Compressing chapters'))).toBe(true) // the parallel path ran

    const out = new Uint8Array(await blob.arrayBuffer())
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expect(a.stream).toMatch(/64 kb\/s/)
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
    expect(a.chapters.map((c) => c.title)).toEqual(specs.map((_, i) => `Chapter ${i + 1}`))
    expect(a.tags.title).toBe('AC\\DC Live; Part=1')
    expect(a.tags.artist).toBe(META.author)
    expectAppleDecodes(out, sourceSec)
  })
})
