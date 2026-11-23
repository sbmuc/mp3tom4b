// @vitest-environment node
/**
 * The description and series tags against the real ffmpeg-core: written by
 * every tool that sets a book's details, in the atoms Audiobookshelf reads
 * (desc, tvsh, tven: "description", "show", "episode_id" to ffprobe), read
 * back by the page the way the editor opens a file, and kept by the tools
 * that only change the audio.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { extractMetadata } from '@/lib/audio/metadata'
import { compressM4B } from '@/lib/ffmpeg/compress'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import { editM4B } from '@/lib/ffmpeg/editM4b'
import { mergeM4B } from '@/lib/ffmpeg/mergeM4b'
import { META, TEN_ODD_CHAPTERS, analyze, asAudioFile, mp3, toneFile, total, type ToneSpec } from './helpers'

// The compressor's parallel path (the one that rewrites the tags from a dump)
// only runs with more than one worker.
beforeAll(() => {
  vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
})

const DESCRIPTION = 'A hobbit goes there; and = back again.\n\nSecond paragraph, with “quotes” & #hash.'
const DETAILS = { ...META, description: DESCRIPTION, series: 'Middle-earth', seriesPart: '1.5' }

async function book(specs: ToneSpec[], metadata = DETAILS): Promise<File> {
  const files = await Promise.all(specs.map(async (s, i) => asAudioFile(await toneFile(s), i)))
  const { blob } = await convertToM4B({ files, metadata, coverFile: null, bitrate: 64 })
  return new File([blob], 'book.m4b')
}

const asFile = (blob: Blob) => new File([blob], 'out.m4b')

/** The four-letter atom names in the file's tags. */
async function atoms(file: Blob): Promise<string> {
  return new TextDecoder('latin1').decode(new Uint8Array(await file.arrayBuffer()))
}

describe('description and series tags', () => {
  it('the converter writes them where Audiobookshelf reads them, and the page reads them back', async () => {
    const file = await book([mp3(440), mp3(660)])
    const text = await atoms(file)
    for (const atom of ['desc', 'ldes', 'tvsh', 'tven']) expect(text).toContain(atom)

    const probe = await analyze(new Uint8Array(await file.arrayBuffer()))
    expect(probe.tags.show).toBe('Middle-earth')
    expect(probe.tags.episode_id).toBe('1.5')
    expect(probe.tags.description).toBeDefined()

    const read = await extractMetadata(file)
    expect(read.description).toBe(DESCRIPTION)
    expect(read.series).toBe('Middle-earth')
    expect(read.seriesPart).toBe('1.5')
  })

  it('a long description survives whole', async () => {
    // Store descriptions run to a few thousand characters.
    const long = Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1}: ${'words; = # \\ and more '.repeat(3)}`).join('\n\n')
    const file = await book([mp3(440)], { ...META, description: long })
    expect(long.length).toBeGreaterThan(5000)
    expect((await extractMetadata(file)).description).toBe(long.trim())
  })

  it('a book without them gets none of the four atoms', async () => {
    const file = await book([mp3(440)], META)
    const text = await atoms(file)
    for (const atom of ['desc', 'ldes', 'tvsh', 'tven']) expect(text).not.toContain(atom)
  })

  it('the editor keeps them when it saves, and changes them when asked', async () => {
    const file = await book([mp3(440), mp3(660)])
    const opened = await extractMetadata(file)
    const before = await analyze(new Uint8Array(await file.arrayBuffer()))
    const durationMs = before.chapters.at(-1)!.endMs
    const chapters = before.chapters.map((c) => ({ startMs: c.startMs, title: c.title }))

    // Opened and saved with only the title changed: the rest stays.
    const kept = await editM4B({
      file,
      chapters,
      metadata: {
        ...META,
        title: 'Renamed',
        description: opened.description ?? '',
        series: opened.series ?? '',
        seriesPart: opened.seriesPart ?? '',
      },
      cover: { mode: 'remove' },
      durationMs,
    })
    expect(await extractMetadata(asFile(kept))).toMatchObject({ title: 'Renamed', description: DESCRIPTION, series: 'Middle-earth', seriesPart: '1.5' })

    // Cleared: gone from the file.
    const cleared = await editM4B({ file, chapters, metadata: { ...META }, cover: { mode: 'remove' }, durationMs })
    const read = await extractMetadata(asFile(cleared))
    expect(read.description).toBeUndefined()
    expect(read.series).toBeUndefined()
    expect(read.seriesPart).toBeUndefined()
  })

  it('the merger writes them', async () => {
    const a = await book([mp3(440)], META)
    const b = await book([mp3(880)], META)
    const blob = await mergeM4B({
      files: [a, b],
      parts: [
        { title: 'A', durationMs: 3000, chapters: [] },
        { title: 'B', durationMs: 3000, chapters: [] },
      ],
      metadata: { ...DETAILS, title: 'Merged' },
      chapterMode: 'perFile',
      cover: { mode: 'remove' },
      reencode: false,
      bitrate: 64,
      target: { sampleRate: 44100, channels: 2 },
      totalDurationMs: 6000,
    })
    expect(await extractMetadata(asFile(blob))).toMatchObject({ title: 'Merged', description: DESCRIPTION, series: 'Middle-earth', seriesPart: '1.5' })
  })

  it('the compressor keeps them', async () => {
    const specs = TEN_ODD_CHAPTERS.slice(0, 4)
    const source = await book(specs)
    const labels: string[] = []
    const blob = await compressM4B({
      file: source,
      bitrate: 32,
      hasCover: false,
      durationMs: total(specs) * 1000,
      onProgress: (p) => labels.push(p.label),
    })
    expect(labels.some((l) => l.startsWith('Compressing chapters'))).toBe(true) // the parallel path ran
    expect(await extractMetadata(asFile(blob))).toMatchObject({ description: DESCRIPTION, series: 'Middle-earth', seriesPart: '1.5' })
  })
})
