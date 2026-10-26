// @vitest-environment node
/**
 * The M4B merger and chapter editor against the real ffmpeg-core: the inputs
 * are chaptered M4Bs made by the converter, so every chapter is a known tone
 * and each marker can be checked against the audio.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { convertToM4B } from '@/lib/ffmpeg/convert'
import { editM4B } from '@/lib/ffmpeg/editM4b'
import { mergeM4B } from '@/lib/ffmpeg/mergeM4b'
import { META, analyze, asAudioFile, expectChaptersMatchAudio, mp3, toneFile, type ToneSpec } from './helpers'

async function book(specs: ToneSpec[], title: string): Promise<File> {
  const files = await Promise.all(specs.map(async (s, i) => asAudioFile(await toneFile(s), i)))
  const blob = await convertToM4B({ files, metadata: { ...META, title }, coverFile: null, bitrate: 64 })
  return new File([blob], `${title}.m4b`)
}

describe('mergeM4B', () => {
  it('joins two books with every chapter on its audio', async () => {
    const partA = [mp3(440, 44100, 2, 3), mp3(660, 44100, 2, 4)]
    const partB = [mp3(880, 44100, 2, 2.5), mp3(1100, 44100, 2, 3.5)]
    const files = [await book(partA, 'Part A'), await book(partB, 'Part B')]
    // The timelines the merge tool reads from each file when it's dropped in.
    const a = await analyze(new Uint8Array(await files[0].arrayBuffer()))
    const b = await analyze(new Uint8Array(await files[1].arrayBuffer()))
    const durA = a.chapters.at(-1)!.endMs
    const durB = b.chapters.at(-1)!.endMs
    const parts = [
      { title: 'Part A', durationMs: durA, chapters: a.chapters.map((c, i) => ({ ...c, title: `A${i + 1}` })) },
      { title: 'Part B', durationMs: durB, chapters: b.chapters.map((c, i) => ({ ...c, title: `B${i + 1}` })) },
    ]
    const blob = await mergeM4B({
      files, parts, metadata: { ...META, title: 'Merged' }, chapterMode: 'keep', cover: { mode: 'remove' },
      reencode: false, bitrate: 64, target: { sampleRate: 44100, channels: 2 }, totalDurationMs: durA + durB,
    })
    const out = await analyze(new Uint8Array(await blob.arrayBuffer()))
    expect(out.decodeErrors).toEqual([])
    expect(out.chapters.map((c) => c.title)).toEqual(['A1', 'A2', 'B1', 'B2'])
    expect(out.tags.title).toBe('Merged')
    expectChaptersMatchAudio(out, [...partA, ...partB], { maxLeadMs: 130 })
  })
})

describe('editM4B', () => {
  it('renames chapters and retags the book without touching the audio', async () => {
    const specs = [mp3(440), mp3(660), mp3(880)]
    const file = await book(specs, 'Before')
    const before = await analyze(new Uint8Array(await file.arrayBuffer()))
    const blob = await editM4B({
      file,
      chapters: before.chapters.map((c, i) => ({ startMs: c.startMs, title: `Renamed ${i + 1}` })),
      metadata: { ...META, title: 'After' },
      cover: { mode: 'remove' },
      durationMs: before.chapters.at(-1)!.endMs,
    })
    const after = await analyze(new Uint8Array(await blob.arrayBuffer()))
    expect(after.decodeErrors).toEqual([])
    expect(after.chapters.map((c) => c.title)).toEqual(['Renamed 1', 'Renamed 2', 'Renamed 3'])
    expect(after.tags.title).toBe('After')
    expect(after.pcm.length).toBe(before.pcm.length)
    expectChaptersMatchAudio(after, specs)
  })
})
