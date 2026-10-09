/**
 * Chapter markers of an MP4/M4A/M4B, read straight from its boxes so the player
 * can list them without loading ffmpeg.wasm. The parsers are pure; the Blob
 * reader only loads the `moov` box and the chapter titles, never the audio.
 *
 * Two chapter formats exist, and ffmpeg writes both:
 * - a QuickTime chapter track: a text track the audio track points to with
 *   `tref/chap`. This is what Apple Books and iOS read, with no count limit.
 * - a Nero `chpl` box in `moov/udta`, capped at 255 chapters.
 * The chapter track wins when present; `chpl` is the fallback.
 *
 * Why not music-metadata: it expects one chapter title per chunk, but ffmpeg
 * writes all titles into a single chunk, so it returns only the first chapter.
 */

import { child, path, readBoxes, type Box } from './mp4Boxes'

export interface Chapter {
  title: string
  startSec: number
}

/** Where one chapter title sits in the file, and when its chapter starts. */
export interface ChapterSample {
  offset: number // absolute file offset
  size: number
  startSec: number
}

// Guards against garbage tables making us allocate or read without bound.
const MAX_CHAPTERS = 10_000
const MAX_MOOV_BYTES = 64 * 1024 * 1024
const MAX_TOP_LEVEL_BOXES = 1000

const u32 = (view: DataView, box: Box, at: number) => {
  if (box.start + at + 4 > box.end) throw new RangeError('box too short')
  return view.getUint32(box.start + at)
}

function findMoov(view: DataView): Box | null {
  return readBoxes(view, 0, view.byteLength).find((b) => b.type === 'moov') ?? null
}

function trackId(view: DataView, trak: Box): number | null {
  const tkhd = child(view, trak, 'tkhd')
  if (!tkhd) return null
  // version/flags (4), then creation + modification times: 4 bytes each in v0, 8 in v1
  return u32(view, tkhd, view.getUint8(tkhd.start) === 1 ? 20 : 12)
}

/**
 * Locate the QuickTime chapter track's title samples. `bytes` must contain the
 * top-level `moov` box (the whole file, or just that box). Chunk offsets in the
 * sample table are absolute, so the result points into the original file.
 * Returns null when there is no chapter track or its tables are unreadable.
 */
export function chapterTrackSamples(bytes: Uint8Array): ChapterSample[] | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const moov = findMoov(view)
    if (!moov) return null
    const traks = readBoxes(view, moov.start, moov.end).filter((b) => b.type === 'trak')

    let chapterIds: number[] = []
    for (const trak of traks) {
      const chap = path(view, trak, ['tref', 'chap'])
      if (!chap) continue
      for (let at = chap.start; at + 4 <= chap.end; at += 4) chapterIds.push(view.getUint32(at))
      break
    }
    chapterIds = chapterIds.filter((id) => id !== 0)
    const track = traks.find((t) => {
      const id = trackId(view, t)
      return id != null && chapterIds.includes(id)
    })
    if (!track) return null

    const mdhd = path(view, track, ['mdia', 'mdhd'])
    const stbl = path(view, track, ['mdia', 'minf', 'stbl'])
    if (!mdhd || !stbl) return null
    const timescale = u32(view, mdhd, view.getUint8(mdhd.start) === 1 ? 20 : 12)
    if (!timescale) return null

    // Sample sizes (stsz): one shared size, or a table
    const stsz = child(view, stbl, 'stsz')
    if (!stsz) return null
    const sharedSize = u32(view, stsz, 4)
    const count = u32(view, stsz, 8)
    if (count === 0 || count > MAX_CHAPTERS) return null
    const sizes = Array.from({ length: count }, (_, i) => (sharedSize || u32(view, stsz, 12 + i * 4)))

    // Chunk offsets (stco 32-bit, co64 64-bit)
    const stco = child(view, stbl, 'stco')
    const co64 = child(view, stbl, 'co64')
    const chunkOffsets: number[] = []
    if (stco) {
      const n = Math.min(u32(view, stco, 4), MAX_CHAPTERS)
      for (let i = 0; i < n; i++) chunkOffsets.push(u32(view, stco, 8 + i * 4))
    } else if (co64) {
      const n = Math.min(u32(view, co64, 4), MAX_CHAPTERS)
      for (let i = 0; i < n; i++) chunkOffsets.push(u32(view, co64, 8 + i * 8) * 2 ** 32 + u32(view, co64, 12 + i * 8))
    } else return null

    // Samples per chunk (stsc): runs of [first chunk (1-based), samples per chunk]
    const stsc = child(view, stbl, 'stsc')
    if (!stsc) return null
    const runs = Array.from({ length: Math.min(u32(view, stsc, 4), MAX_CHAPTERS) }, (_, i) => ({
      firstChunk: u32(view, stsc, 8 + i * 12),
      perChunk: u32(view, stsc, 12 + i * 12),
    }))

    // Sample durations (stts): runs of [count, delta]
    const stts = child(view, stbl, 'stts')
    if (!stts) return null
    const starts: number[] = []
    let ticks = 0
    for (let i = 0, n = u32(view, stts, 4); i < n && starts.length < count; i++) {
      const runCount = u32(view, stts, 8 + i * 8)
      const delta = u32(view, stts, 12 + i * 8)
      for (let k = 0; k < runCount && starts.length < count; k++) {
        starts.push(ticks)
        ticks += delta
      }
    }

    const samples: ChapterSample[] = []
    for (let c = 0; c < chunkOffsets.length && samples.length < count; c++) {
      let perChunk = 0
      for (const run of runs) if (run.firstChunk <= c + 1) perChunk = run.perChunk
      let offset = chunkOffsets[c]
      for (let k = 0; k < perChunk && samples.length < count; k++) {
        const i = samples.length
        if (starts[i] == null) return null
        samples.push({ offset, size: sizes[i], startSec: starts[i] / timescale })
        offset += sizes[i]
      }
    }
    return samples.length === count ? samples : null
  } catch {
    return null
  }
}

/**
 * Title from one chapter-track sample: a 16-bit length, then the text (UTF-8,
 * or UTF-16 when it opens with a byte-order mark). Anything after the text,
 * such as an `encd` box, is ignored.
 */
export function decodeChapterTitle(sample: Uint8Array): string {
  if (sample.length < 2) return ''
  const len = Math.min((sample[0] << 8) | sample[1], sample.length - 2)
  const text = sample.subarray(2, 2 + len)
  if (text[0] === 0xfe && text[1] === 0xff) return new TextDecoder('utf-16be').decode(text.subarray(2)).trim()
  if (text[0] === 0xff && text[1] === 0xfe) return new TextDecoder('utf-16le').decode(text.subarray(2)).trim()
  return new TextDecoder().decode(text).trim()
}

/**
 * Chapters from the Nero `chpl` box (moov/udta/chpl): version/flags, a reserved
 * word in version 1, a count byte, then per chapter a start in 100 ns units and
 * a length-prefixed UTF-8 title. Returns null when the box is missing.
 */
export function parseChpl(bytes: Uint8Array): Chapter[] | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const moov = findMoov(view)
    const chpl = moov && path(view, moov, ['udta', 'chpl'])
    if (!chpl) return null
    let at = chpl.start + (view.getUint8(chpl.start) >= 1 ? 8 : 4)
    const count = view.getUint8(at++)
    const chapters: Chapter[] = []
    for (let i = 0; i < count; i++) {
      if (at + 9 > chpl.end) break
      const start = Number(view.getBigUint64(at))
      const len = view.getUint8(at + 8)
      at += 9
      const title = new TextDecoder().decode(bytes.subarray(at, Math.min(at + len, chpl.end))).trim()
      at += len
      chapters.push({ title, startSec: start / 1e7 })
    }
    return chapters
  } catch {
    return null
  }
}

async function readBytes(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

/** The top-level `moov` box, found by walking box headers so the audio is never read. */
async function readMoov(file: Blob): Promise<Uint8Array | null> {
  let offset = 0
  for (let n = 0; n < MAX_TOP_LEVEL_BOXES && offset + 8 <= file.size; n++) {
    const head = await readBytes(file, offset, offset + 16)
    const view = new DataView(head.buffer)
    let size = view.getUint32(0)
    const type = String.fromCharCode(head[4], head[5], head[6], head[7])
    if (size === 1) {
      if (head.length < 16) return null
      size = Number(view.getBigUint64(8))
    } else if (size === 0) {
      size = file.size - offset
    }
    if (size < 8) return null
    if (type === 'moov') return size > MAX_MOOV_BYTES ? null : readBytes(file, offset, offset + size)
    offset += size
  }
  return null
}

/**
 * Chapters of an MP4/M4A/M4B file, sorted by start. Empty when the file has
 * none or can't be read; reading chapters never stops playback.
 */
export async function readMp4Chapters(file: Blob): Promise<Chapter[]> {
  try {
    const moov = await readMoov(file)
    if (!moov) return []

    const samples = chapterTrackSamples(moov)
    if (samples?.length) {
      // Titles usually sit together in one chunk; read them in one go when they do.
      const first = Math.min(...samples.map((s) => s.offset))
      const last = Math.max(...samples.map((s) => s.offset + s.size))
      const span = last - first <= 1024 * 1024 ? await readBytes(file, first, last) : null
      const chapters = await Promise.all(
        samples.map(async (s) => ({
          title: decodeChapterTitle(
            span ? span.subarray(s.offset - first, s.offset - first + s.size) : await readBytes(file, s.offset, s.offset + s.size),
          ),
          startSec: s.startSec,
        })),
      )
      return chapters.sort((a, b) => a.startSec - b.startSec)
    }

    return (parseChpl(moov) ?? []).sort((a, b) => a.startSec - b.startSec)
  } catch {
    return []
  }
}
