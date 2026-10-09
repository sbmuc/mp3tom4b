import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { chapterTrackSamples, decodeChapterTitle, parseChpl, readMp4Chapters } from '@/lib/audio/mp4Chapters'

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, '../../fixtures', name)))
const blob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)])

// Both fixtures were made by the shipped ffmpeg-core from an ffmetadata file
// with these three chapters; one has `+faststart` (moov first), one doesn't.
const EXPECTED = [
  { title: 'Opening', startSec: 0 },
  { title: 'Café — Deux', startSec: 1 },
  { title: '日本語の章', startSec: 2.5 },
]
const FIXTURES = ['aac-3-chapters-faststart.m4b', 'aac-3-chapters.m4b']

describe('real ffmpeg output', () => {
  it.each(FIXTURES)('reads the chapter track of %s', (name) => {
    const bytes = fixture(name)
    const samples = chapterTrackSamples(bytes)!
    expect(samples.map((s) => s.startSec)).toEqual([0, 1, 2.5])
    expect(samples.map((s) => decodeChapterTitle(bytes.subarray(s.offset, s.offset + s.size)))).toEqual(
      EXPECTED.map((c) => c.title),
    )
  })

  it.each(FIXTURES)('reads the chpl box of %s', (name) => {
    expect(parseChpl(fixture(name))).toEqual(EXPECTED)
  })

  it.each(FIXTURES)('reads %s from a Blob without loading the audio', async (name) => {
    expect(await readMp4Chapters(blob(fixture(name)))).toEqual(EXPECTED)
  })

  it('finds nothing in a file without chapters', async () => {
    const bytes = fixture('aac-44k-stereo.m4a')
    expect(chapterTrackSamples(bytes)).toBeNull()
    expect(parseChpl(bytes)).toBeNull()
    expect(await readMp4Chapters(blob(bytes))).toEqual([])
  })
})

// --- synthetic boxes -------------------------------------------------------

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const size = 8 + payload.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(size)
  new DataView(out.buffer).setUint32(0, size)
  out.set(new TextEncoder().encode(type), 4)
  let o = 8
  for (const p of payload) {
    out.set(p, o)
    o += p.length
  }
  return out
}
function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4)
  values.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v))
  return out
}
function u64(value: number): Uint8Array {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigUint64(0, BigInt(value))
  return out
}
const concat = (...parts: Uint8Array[]) => box('xxxx', ...parts).subarray(8)
const tkhd = (id: number) => box('tkhd', u32(0, 0, 0, id, 0))
const mdhd = (timescale: number) => box('mdhd', u32(0, 0, 0, timescale, 0))

/** A QuickTime text sample: 16-bit length + bytes. */
function textSample(bytes: Uint8Array): Uint8Array {
  return concat(new Uint8Array([bytes.length >> 8, bytes.length & 0xff]), bytes)
}
const utf8 = (s: string) => new TextEncoder().encode(s)

interface TrackSpec {
  timescale: number
  durations: number[]
  samples: Uint8Array[]
  samplesPerChunk: number
  co64?: boolean
}

/** moov (audio trak → tref/chap → text trak) followed by an mdat holding the titles. */
function fileWithChapterTrack(spec: TrackSpec, extraMoov: Uint8Array[] = []): Uint8Array {
  const build = (mdatPayloadAt: number) => {
    const chunks: number[] = []
    let at = mdatPayloadAt
    spec.samples.forEach((s, i) => {
      if (i % spec.samplesPerChunk === 0) chunks.push(at)
      at += s.length
    })
    const chunkBox = spec.co64
      ? box('co64', u32(0, chunks.length), ...chunks.map(u64))
      : box('stco', u32(0, chunks.length, ...chunks))
    const stbl = box(
      'stbl',
      box('stts', u32(0, spec.durations.length, ...spec.durations.flatMap((d) => [1, d]))),
      box('stsc', u32(0, 1, 1, spec.samplesPerChunk, 1)),
      box('stsz', u32(0, 0, spec.samples.length, ...spec.samples.map((s) => s.length))),
      chunkBox,
    )
    const audio = box('trak', tkhd(1), box('tref', box('chap', u32(2))))
    const text = box('trak', tkhd(2), box('mdia', mdhd(spec.timescale), box('minf', stbl)))
    return box('moov', audio, text, ...extraMoov)
  }
  const moovSize = build(0).length
  return concat(build(moovSize + 8), box('mdat', ...spec.samples))
}

describe('chapter track — box handling', () => {
  it('walks several chunks and turns tick durations into start times', async () => {
    const titles = ['One', 'Two', 'Three', 'Four', 'Five']
    const file = fileWithChapterTrack({
      timescale: 600,
      durations: [600, 1200, 300, 900, 600],
      samples: titles.map((t) => textSample(utf8(t))),
      samplesPerChunk: 2,
    })
    expect(await readMp4Chapters(blob(file))).toEqual([
      { title: 'One', startSec: 0 },
      { title: 'Two', startSec: 1 },
      { title: 'Three', startSec: 3 },
      { title: 'Four', startSec: 3.5 },
      { title: 'Five', startSec: 5 },
    ])
  })

  it('reads 64-bit chunk offsets (co64)', async () => {
    const file = fileWithChapterTrack({
      timescale: 1000,
      durations: [1000, 1000],
      samples: [textSample(utf8('A')), textSample(utf8('B'))],
      samplesPerChunk: 1,
      co64: true,
    })
    expect((await readMp4Chapters(blob(file))).map((c) => c.title)).toEqual(['A', 'B'])
  })

  it('has no 255-chapter cap (unlike chpl)', async () => {
    const titles = Array.from({ length: 300 }, (_, i) => `Chapter ${i + 1}`)
    const file = fileWithChapterTrack({
      timescale: 1,
      durations: titles.map(() => 60),
      samples: titles.map((t) => textSample(utf8(t))),
      samplesPerChunk: 300,
    })
    const chapters = await readMp4Chapters(blob(file))
    expect(chapters).toHaveLength(300)
    expect(chapters[299]).toEqual({ title: 'Chapter 300', startSec: 299 * 60 })
  })

  it('prefers the chapter track over chpl when both exist', async () => {
    const chpl = box('udta', box('chpl', u32(0x01000000, 0), new Uint8Array([1]), u64(0), new Uint8Array([3]), utf8('Old')))
    const file = fileWithChapterTrack(
      { timescale: 1, durations: [5], samples: [textSample(utf8('New'))], samplesPerChunk: 1 },
      [chpl],
    )
    expect(await readMp4Chapters(blob(file))).toEqual([{ title: 'New', startSec: 0 }])
  })

  it('returns null for truncated sample tables instead of throwing', () => {
    const file = fileWithChapterTrack({ timescale: 1, durations: [1, 1], samples: [textSample(utf8('A')), textSample(utf8('B'))], samplesPerChunk: 1 })
    const moovSize = new DataView(file.buffer, file.byteOffset).getUint32(0)
    // Chop the moov in the middle of the text track's tables
    const cut = file.slice(0, moovSize - 20)
    new DataView(cut.buffer).setUint32(0, cut.length)
    expect(chapterTrackSamples(cut)).toBeNull()
    expect(chapterTrackSamples(new Uint8Array(0))).toBeNull()
  })
})

describe('decodeChapterTitle', () => {
  it('decodes UTF-8 and ignores the trailing encd box', () => {
    const sample = concat(textSample(utf8('Café')), box('encd', u32(0x100)))
    expect(decodeChapterTitle(sample)).toBe('Café')
  })

  it('decodes UTF-16 with a byte-order mark', () => {
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x48, 0x00, 0xe9])
    const le = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0xe9, 0x00])
    expect(decodeChapterTitle(textSample(be))).toBe('Hé')
    expect(decodeChapterTitle(textSample(le))).toBe('Hé')
  })

  it('clamps a length that runs past the sample', () => {
    expect(decodeChapterTitle(new Uint8Array([0x00, 0x10, 0x41, 0x42]))).toBe('AB')
    expect(decodeChapterTitle(new Uint8Array([0x00]))).toBe('')
  })
})

describe('parseChpl', () => {
  const entry = (start100ns: number, title: string) => concat(u64(start100ns), new Uint8Array([utf8(title).length]), utf8(title))

  it('reads version 0 (no reserved word)', () => {
    const moov = box('moov', box('udta', box('chpl', u32(0), new Uint8Array([2]), entry(0, 'A'), entry(15_000_000, 'B'))))
    expect(parseChpl(moov)).toEqual([
      { title: 'A', startSec: 0 },
      { title: 'B', startSec: 1.5 },
    ])
  })

  it('stops at the end of a truncated box', () => {
    const moov = box('moov', box('udta', box('chpl', u32(0x01000000, 0), new Uint8Array([3]), entry(0, 'A'))))
    expect(parseChpl(moov)).toEqual([{ title: 'A', startSec: 0 }])
  })

  it('falls back to chpl when there is no chapter track', async () => {
    const moov = box('moov', box('udta', box('chpl', u32(0x01000000, 0), new Uint8Array([1]), entry(20_000_000, 'Only'))))
    expect(await readMp4Chapters(blob(moov))).toEqual([{ title: 'Only', startSec: 2 }])
  })
})
