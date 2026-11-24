import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractMetadata } from '@/lib/audio/metadata'

// Hoisted mock — `vi.mock` calls are lifted above all imports.
vi.mock('music-metadata', () => ({
  parseBlob: vi.fn(),
}))

import { parseBlob } from 'music-metadata'

const parseBlobMock = vi.mocked(parseBlob)

const dummyFile = () => new File([new Uint8Array(0)], 'x.mp3', { type: 'audio/mpeg' })

beforeEach(() => {
  parseBlobMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('extractMetadata — happy path field mapping', () => {
  it('maps album→title, artist→author, composer[0]→narrator, year→year string', async () => {
    parseBlobMock.mockResolvedValue({
      common: {
        album: '  The Hobbit  ',
        artist: 'J.R.R. Tolkien',
        albumartist: 'Should be ignored when artist exists',
        composer: ['Andy Serkis'],
        year: 2020,
        title: 'Chapter One: An Unexpected Party',
      },
      format: { duration: 1234.567 },
    } as never)

    const result = await extractMetadata(dummyFile())
    expect(result.title).toBe('The Hobbit')
    expect(result.author).toBe('J.R.R. Tolkien')
    expect(result.narrator).toBe('Andy Serkis')
    expect(result.year).toBe('2020')
    expect(result.chapterTitle).toBe('Chapter One: An Unexpected Party')
    expect(result.durationMs).toBe(1234567)
  })

  it('falls back to albumartist when artist is missing', async () => {
    parseBlobMock.mockResolvedValue({
      common: {
        albumartist: 'Stephen Fry',
      },
      format: {},
    } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.author).toBe('Stephen Fry')
  })

  it('returns undefined for fields that are missing', async () => {
    parseBlobMock.mockResolvedValue({ common: {}, format: {} } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.title).toBeUndefined()
    expect(result.author).toBeUndefined()
    expect(result.narrator).toBeUndefined()
    expect(result.year).toBeUndefined()
    expect(result.genre).toBeUndefined()
    expect(result.chapterTitle).toBeUndefined()
    expect(result.coverFile).toBeUndefined()
    expect(result.durationMs).toBeUndefined()
  })
})

describe('extractMetadata — description and series', () => {
  it("reads an M4B's long description before its short one, and its series from tvsh and tven", async () => {
    parseBlobMock.mockResolvedValue({
      common: {
        description: ['Short.'],
        longDescription: ' The whole description. ',
        tvShow: ' Discworld ',
        tvEpisodeId: '3',
        movementIndex: { no: null, of: null },
      },
      format: {},
      native: {},
    } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.description).toBe('The whole description.')
    expect(result.series).toBe('Discworld')
    expect(result.seriesPart).toBe('3')
  })

  it('reads the movement tags and a SERIES text tag, as Audiobookshelf does', async () => {
    parseBlobMock.mockResolvedValue({
      common: { movement: 'The Expanse', movementIndex: { no: 2, of: 9 }, description: ['From TDES'] },
      format: {},
      native: {},
    } as never)
    expect(await extractMetadata(dummyFile())).toMatchObject({ series: 'The Expanse', seriesPart: '2', description: 'From TDES' })

    parseBlobMock.mockResolvedValue({
      common: { movementIndex: { no: null, of: null } },
      format: {},
      native: { 'ID3v2.3': [{ id: 'TXXX:series', value: 'Mistborn' }, { id: 'TXXX:series-part', value: ['1'] }] },
    } as never)
    expect(await extractMetadata(dummyFile())).toMatchObject({ series: 'Mistborn', seriesPart: '1' })
  })

  it('leaves them out when the file has none', async () => {
    parseBlobMock.mockResolvedValue({ common: { movementIndex: { no: null, of: null } }, format: {}, native: {} } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.description).toBeUndefined()
    expect(result.series).toBeUndefined()
    expect(result.seriesPart).toBeUndefined()
  })
})

describe('extractMetadata — genre filtering', () => {
  it('accepts known genre values case-insensitively', async () => {
    parseBlobMock.mockResolvedValue({
      common: { genre: ['audiobook'] },
      format: {},
    } as never)
    expect((await extractMetadata(dummyFile())).genre).toBe('Audiobook')

    parseBlobMock.mockResolvedValue({
      common: { genre: ['PODCAST'] },
      format: {},
    } as never)
    expect((await extractMetadata(dummyFile())).genre).toBe('Podcast')
  })

  it('drops genres that do not match the allowed enum', async () => {
    parseBlobMock.mockResolvedValue({
      common: { genre: ['Sci-Fi'] },
      format: {},
    } as never)
    expect((await extractMetadata(dummyFile())).genre).toBeUndefined()
  })
})

describe('extractMetadata — duration', () => {
  it('rounds duration to milliseconds', async () => {
    parseBlobMock.mockResolvedValue({
      common: {},
      format: { duration: 12.3456 },
    } as never)
    expect((await extractMetadata(dummyFile())).durationMs).toBe(12346)
  })

  it('returns undefined when duration is missing or non-finite', async () => {
    parseBlobMock.mockResolvedValue({ common: {}, format: {} } as never)
    expect((await extractMetadata(dummyFile())).durationMs).toBeUndefined()

    parseBlobMock.mockResolvedValue({
      common: {},
      format: { duration: Number.NaN },
    } as never)
    expect((await extractMetadata(dummyFile())).durationMs).toBeUndefined()

    parseBlobMock.mockResolvedValue({
      common: {},
      format: { duration: Number.POSITIVE_INFINITY },
    } as never)
    expect((await extractMetadata(dummyFile())).durationMs).toBeUndefined()
  })
})

describe('extractMetadata — source audio format', () => {
  it('captures sample rate, channel count and codec', async () => {
    parseBlobMock.mockResolvedValue({
      common: {},
      format: { sampleRate: 22050, numberOfChannels: 1, codec: 'MPEG 2 Layer 3' },
    } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.sourceSampleRate).toBe(22050)
    expect(result.sourceChannels).toBe(1)
    expect(result.sourceCodec).toBe('MPEG 2 Layer 3')
  })

  it('leaves them undefined when the header does not report them', async () => {
    parseBlobMock.mockResolvedValue({ common: {}, format: { sampleRate: 0 } } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.sourceSampleRate).toBeUndefined()
    expect(result.sourceChannels).toBeUndefined()
    expect(result.sourceCodec).toBeUndefined()
  })
})

describe('extractMetadata — cover art', () => {
  it('wraps embedded picture data into a File with the right MIME type', async () => {
    const data = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    parseBlobMock.mockResolvedValue({
      common: { picture: [{ format: 'image/jpeg', data }] },
      format: {},
    } as never)

    const result = await extractMetadata(dummyFile())
    expect(result.coverFile).toBeInstanceOf(File)
    expect(result.coverFile?.type).toBe('image/jpeg')
    expect(result.coverFile?.name).toBe('embedded-cover.jpg')
    expect(result.coverFile?.size).toBe(4)
  })

  it('uses .png extension for PNG covers', async () => {
    parseBlobMock.mockResolvedValue({
      common: { picture: [{ format: 'image/png', data: new Uint8Array([0x89, 0x50]) }] },
      format: {},
    } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.coverFile?.type).toBe('image/png')
    expect(result.coverFile?.name).toBe('embedded-cover.png')
  })
})

describe('extractMetadata — failure', () => {
  it('returns an empty object when parseBlob throws', async () => {
    parseBlobMock.mockRejectedValue(new Error('corrupt headers'))
    const result = await extractMetadata(dummyFile())
    expect(result).toEqual({})
  })
})

describe('extractMetadata — date and disc', () => {
  it('reads a full date instead of only its year, and the disc number', async () => {
    parseBlobMock.mockResolvedValue({
      common: { year: 2024, date: '2024-04-03T07:00:00Z', disk: { no: 2, of: 3 } },
      format: {},
    } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.year).toBe('2024-04-03')
    expect(result.disc).toBe('2/3')
  })

  it('reads the year when the date is only a year, and no disc when there is none', async () => {
    parseBlobMock.mockResolvedValue({ common: { year: 1937, date: '1937', disk: { no: null, of: null } }, format: {} } as never)
    const result = await extractMetadata(dummyFile())
    expect(result.year).toBe('1937')
    expect(result.disc).toBeUndefined()
  })
})
