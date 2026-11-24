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

async function chapterize(
  specs: ToneSpec[],
  format: ToneSpec['format'],
  o: { name?: string; durationMs?: number; extraStartsMs?: number[] } = {},
) {
  const made = await longToneFile(specs, format)
  const file = o.name ? new File([made], o.name) : made
  let at = 0
  const chapters = specs.map((t, i) => {
    const startMs = Math.round(at * 1000)
    at += t.sec
    return { startMs, title: `Part ${i + 1}` }
  })
  for (const startMs of o.extraStartsMs ?? []) chapters.push({ startMs, title: 'Past the end' })
  const labels: string[] = []
  const blob = await chapterizeFile({
    file,
    chapters,
    metadata: META,
    cover: { mode: 'remove' },
    bitrate: 64,
    durationMs: o.durationMs ?? total(specs) * 1000,
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

  it('splits an AAC file named .mp3 all the same, with the chapters on the audio', async () => {
    // Seen in the field: the .mp3 muxer refused the AAC inside, and every try
    // failed at once with "ffmpeg exited with code 1".
    const specs = TEN_ODD_CHAPTERS
    const a = await analyze(await chapterize(specs, 'm4a', { name: 'lecture.mp3' }))
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
  })

  it('reads the length itself when the page could not (it used to fail as "out of memory")', async () => {
    const specs = TEN_ODD_CHAPTERS
    const a = await analyze(await chapterize(specs, 'mp3', { durationMs: 0 }))
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
  })

  it('leaves out a chapter past the end when the file is shorter than the page thought (it used to fail with "FS error")', async () => {
    const specs = TEN_ODD_CHAPTERS
    const realMs = total(specs) * 1000
    const a = await analyze(await chapterize(specs, 'mp3', { durationMs: realMs + 20_000, extraStartsMs: [realMs + 5_000] }))
    expect(a.chapters.map((c) => c.title)).toEqual(specs.map((_, i) => `Part ${i + 1}`))
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
  })

  it('keeps the chapters on the audio for a long WAV', async () => {
    const specs = TEN_ODD_CHAPTERS
    const a = await analyze(await chapterize(specs, 'wav'))
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs, { maxLeadMs: SPLIT_LEAD_MS })
  })
})
