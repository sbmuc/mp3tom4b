/**
 * The M4B tools on real audiobooks made elsewhere: reading their chapters,
 * editing, splitting, compressing and merging.
 */
import { describe, expect, it, vi } from 'vitest'
import { readZipEntries, entryBlob } from '@/lib/archive/zip'
import { readMp4Chapters } from '@/lib/audio/mp4Chapters'
import { parseBlob } from 'music-metadata'
import { compressM4B } from '@/lib/ffmpeg/compress'
import { editM4B } from '@/lib/ffmpeg/editM4b'
import { mergeM4B } from '@/lib/ffmpeg/mergeM4b'
import { probeM4bInfo } from '@/lib/ffmpeg/probeM4b'
import { splitM4B } from '@/lib/ffmpeg/split'
import { probeChapters } from '@/lib/ffmpeg/splitChapters'
import { CHAMBER_M4B, FULL, HAVE_FILES, META, PHOENIX_M4B, bookInfo, coverImage, coverStream, realFile } from './files'

// The browser shrinks a new cover on a canvas first; here it goes in as stored.
vi.mock('@/lib/image/resize', () => ({ resizeCoverImage: async (f: File) => f }))

const HOUR = 3600

describe.skipIf(!HAVE_FILES)('M4B tools on real audiobooks', () => {
  it('reads both books the same way in the tools and in the player', async () => {
    for (const [rel, count, hours, first] of [
      [CHAMBER_M4B, 20, 9.62, 'Opening Credits'],
      [PHOENIX_M4B, 40, 26.67, 'Opening Credits'],
    ] as const) {
      const file = await realFile(rel)
      const [chapters, info, player] = await Promise.all([probeChapters(file), probeM4bInfo(file), readMp4Chapters(file)])
      expect(chapters).toHaveLength(count)
      expect(chapters[0].title).toBe(first)
      expect(info.chapterCount).toBe(count)
      expect(info.hasCover).toBe(true)
      expect((info.durationMs ?? 0) / 1000 / HOUR).toBeCloseTo(hours, 1)
      expect(player.map((c) => c.title)).toEqual(chapters.map((c) => c.title))
      player.forEach((c, i) => expect(c.startSec).toBeCloseTo(chapters[i].startMs / 1000, 1))
    }
  })

  it('renames a chapter of Chamber of Secrets without touching the audio', async () => {
    const file = await realFile(CHAMBER_M4B)
    const before = await bookInfo(file)
    const chapters = before.chapters.map((c, i) => ({ startMs: c.startSec * 1000, title: i === 1 ? 'Renamed In Test' : c.title }))
    const after = await bookInfo(await editM4B({ file, chapters, metadata: { ...META, title: 'Edited' }, cover: { mode: 'keep' }, durationMs: before.seconds * 1000 }))
    expect(after.chapters.map((c) => c.title)).toEqual(chapters.map((c) => c.title))
    expect(after.seconds).toBeCloseTo(before.seconds, 2)
    expect(after.title).toBe('Edited')
  })

  it('splits the first chapters of Chamber of Secrets into MP3s of the right length', async () => {
    const file = await realFile(CHAMBER_M4B)
    const all = await probeChapters(file)
    const chapters = FULL ? all : all.slice(0, 3)
    const { blob, count } = await splitM4B({ file, bitrate: 64, chapters, meta: { album: 'Chamber' } })
    expect(count).toBe(chapters.length)
    const zip = new File([blob], 'out.zip')
    const entries = await readZipEntries(zip)
    expect(entries).toHaveLength(chapters.length)
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const { format } = await parseBlob(await entryBlob(zip, e, 'audio/mpeg'), { duration: true })
      expect(format.duration ?? 0, e.name).toBeCloseTo((chapters[i].endMs - chapters[i].startMs) / 1000, 0)
    }
  })

  it('re-encodes a real cover (the JPEG encoder used to overrun on real covers and hang)', async () => {
    const file = await realFile(CHAMBER_M4B)
    const before = await bookInfo(file)
    const chapters = before.chapters.map((c) => ({ startMs: c.startSec * 1000, title: c.title }))
    const cover = await coverImage(file)
    const out = await editM4B({ file, chapters, metadata: META, cover: { mode: 'replace', file: cover }, durationMs: before.seconds * 1000 })
    expect(await coverStream(out)).toMatch(/mjpeg.*2400x2400.*attached pic/)
  })

  it.runIf(FULL)('compresses Chamber of Secrets to 64 kbps, keeping every chapter and the cover', async () => {
    const file = await realFile(CHAMBER_M4B)
    const before = await bookInfo(file)
    const out = await compressM4B({ file, bitrate: 64, hasCover: true, durationMs: before.seconds * 1000 })
    const after = await bookInfo(out)
    expect(out.size).toBeLessThan(file.size * 0.6)
    expect(after.chapters.map((c) => c.title)).toEqual(before.chapters.map((c) => c.title))
    expect(after.seconds).toBeCloseTo(before.seconds, -1)
    expect(await coverStream(out)).toMatch(/mjpeg.*attached pic/)
  })

  it.runIf(FULL)('merges Chamber of Secrets and Order of the Phoenix into one 36-hour book', async () => {
    const files = [await realFile(CHAMBER_M4B), await realFile(PHOENIX_M4B)]
    const [a, b] = [await bookInfo(files[0]), await bookInfo(files[1])]
    const parts = [a, b].map((x, i) => ({
      title: `Part ${i + 1}`,
      durationMs: x.seconds * 1000,
      chapters: x.chapters.map((c, j) => ({ title: c.title, startMs: c.startSec * 1000, endMs: (x.chapters[j + 1]?.startSec ?? x.seconds) * 1000 })),
    }))
    const merged = await mergeM4B({ files, parts, metadata: META, chapterMode: 'keep', cover: { mode: 'keep' }, coverSourceIndex: 0, reencode: false, bitrate: 64, target: { sampleRate: 44100, channels: 2 }, totalDurationMs: (a.seconds + b.seconds) * 1000 })
    expect(await coverStream(merged)).toMatch(/mjpeg.*attached pic/)
    const out = await bookInfo(merged)
    expect(out.chapters).toHaveLength(a.chapters.length + b.chapters.length)
    expect(out.seconds).toBeCloseTo(a.seconds + b.seconds, -1)
    expect(out.chapters[a.chapters.length].startSec).toBeCloseTo(a.seconds, 0)
  })
})
