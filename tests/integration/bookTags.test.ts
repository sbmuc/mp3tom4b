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
import { NodeFFmpeg } from './nodeFFmpeg'

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

  it('a release date and a disc number are written, read back and kept', async () => {
    const file = await book([mp3(440)], { ...META, year: '2024-04-03', disc: '2/3' })
    expect((await analyze(new Uint8Array(await file.arrayBuffer()))).tags).toMatchObject({ date: '2024-04-03', disc: '2/3' })
    expect(await extractMetadata(file)).toMatchObject({ year: '2024-04-03', disc: '2/3' })
  })
})

describe('the editor and the tags it does not show', () => {
  // A book tagged in Mp3tag (issue #21): a release date, a disc number, and
  // tags the editor has no field for.
  async function taggedBook(): Promise<File> {
    const ff = await NodeFFmpeg.create()
    const r = await ff.run([
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:a', 'aac', '-b:a', '64k',
      '-metadata', 'title=Spellforge #2', '-metadata', 'album=Spellforge #2', '-metadata', 'artist=Logan Jacobs',
      '-metadata', 'composer=Narrator One, Narrator Two', '-metadata', 'genre=Audiobook',
      '-metadata', 'date=2024-04-03', '-metadata', 'disc=2', '-metadata', 'track=1/1',
      '-metadata', 'comment=Tagged in Mp3tag; = kept', '-metadata', 'copyright=2024 Someone',
      '-f', 'mp4', 'tagged.m4b',
    ])
    expect(r.ret).toBe(0)
    const bytes = await ff.readFile('tagged.m4b')
    ff.terminate()
    return new File([new Uint8Array(bytes)], 'tagged.m4b')
  }

  async function save(file: File, change: (m: typeof META) => typeof META) {
    const opened = await extractMetadata(file)
    const metadata = change({
      ...META,
      title: opened.title ?? '',
      author: opened.author ?? '',
      narrator: opened.narrator ?? '',
      year: opened.year ?? '',
      disc: opened.disc ?? '',
    })
    const blob = await editM4B({ file, chapters: [{ startMs: 0, title: 'One' }], metadata, cover: { mode: 'remove' }, durationMs: 6000 })
    return (await analyze(new Uint8Array(await blob.arrayBuffer()))).tags
  }

  it('keeps them, with the full date and the disc number, when only the title changes', async () => {
    // They used to be dropped, and the date cut to 2024.
    const tags = await save(await taggedBook(), (m) => ({ ...m, title: 'Spellforge, Book 2' }))
    expect(tags).toMatchObject({
      title: 'Spellforge, Book 2',
      date: '2024-04-03',
      disc: '2',
      track: '1/1',
      comment: 'Tagged in Mp3tag; = kept',
      copyright: '2024 Someone',
    })
  })

  it('changes and clears the ones it shows, and still keeps the rest', async () => {
    const tags = await save(await taggedBook(), (m) => ({ ...m, year: '2024', disc: '', narrator: '' }))
    expect(tags.date).toBe('2024')
    expect(tags.disc).toBeUndefined()
    expect(tags.composer).toBeUndefined()
    expect(tags).toMatchObject({ track: '1/1', comment: 'Tagged in Mp3tag; = kept', copyright: '2024 Someone' })
  })
})

