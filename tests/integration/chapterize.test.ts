// @vitest-environment node
/**
 * "Add chapters to a single file" (parallel path: split at the chapter marks →
 * re-encode pieces in workers → join) against the real ffmpeg-core. The input
 * is one long file of back-to-back tones; the chapters the user sets at the
 * tone changes must still sit on those changes in the output.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { chapterizeFile } from '@/lib/ffmpeg/chapterize'
import {
  META,
  TEN_ODD_CHAPTERS,
  analyze,
  expectAppleDecodes,
  expectChaptersMatchAudio,
  longToneFile,
  total,
  type ToneSpec,
} from './helpers'

beforeAll(() => {
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
})

// Each cut costs a fixed lead (see expectChaptersMatchAudio); what matters is
// that it doesn't grow and the marker never lands after the sound.
const SPLIT_LEAD_MS = 130

async function chapterize(specs: ToneSpec[], format: ToneSpec['format']) {
  const file = await longToneFile(specs, format)
  let at = 0
  const chapters = specs.map((t, i) => {
    const startMs = Math.round(at * 1000)
    at += t.sec
    return { startMs, title: `Part ${i + 1}` }
  })
  const labels: string[] = []
  const blob = await chapterizeFile({
    file,
    chapters,
    metadata: META,
    cover: { mode: 'remove' },
    bitrate: 64,
    durationMs: total(specs) * 1000,
    onProgress: (p) => labels.push(p.label),
  })
  expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(true) // the parallel path ran
  return new Uint8Array(await blob.arrayBuffer())
}

describe('chapterizeFile — parallel path', () => {
  it('keeps the chapters on the audio for a long MP3', async () => {
    const specs = TEN_ODD_CHAPTERS
    const out = await chapterize(specs, 'mp3')
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
    expect(a.chapters.map((c) => c.title)).toEqual(specs.map((_, i) => `Part ${i + 1}`))
    expectAppleDecodes(out, total(specs))
  })

  it('keeps the chapters on the audio for a long WAV', async () => {
    const specs = TEN_ODD_CHAPTERS
    const a = await analyze(await chapterize(specs, 'wav'))
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
  })
})
