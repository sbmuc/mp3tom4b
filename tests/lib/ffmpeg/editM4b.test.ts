import { describe, expect, it } from 'vitest'
import { buildEditMetadata, buildEditMuxArgs, type EditChapter } from '@/lib/ffmpeg/editM4b'
import type { ConversionMetadata } from '@/types'

const meta: ConversionMetadata = {
  title: 'My Book',
  author: 'Some Author',
  narrator: 'A Narrator',
  year: '1937',
  genre: 'Audiobook',
}

const chapters: EditChapter[] = [
  { startMs: 0, title: 'Intro' },
  { startMs: 60000, title: 'One' },
  { startMs: 120000, title: 'Two' },
]

describe('buildEditMetadata', () => {
  it('writes the global tags', () => {
    const out = buildEditMetadata(meta, chapters, 180000)
    expect(out.startsWith(';FFMETADATA1\n')).toBe(true)
    expect(out).toContain('title=My Book')
    expect(out).toContain('artist=Some Author')
    expect(out).toContain('album=My Book')
    expect(out).toContain('album_artist=Some Author')
    expect(out).toContain('composer=A Narrator')
    expect(out).toContain('date=1937')
    expect(out).toContain('genre=Audiobook')
  })

  it('derives each chapter END from the next start, and the last from duration', () => {
    const out = buildEditMetadata(meta, chapters, 180000)
    expect(out).toContain('START=0')
    expect(out).toContain('END=60000')
    expect(out).toContain('START=60000')
    expect(out).toContain('END=120000')
    expect(out).toContain('START=120000')
    expect(out).toContain('END=180000') // last → duration
    expect((out.match(/\[CHAPTER\]/g) || []).length).toBe(3)
  })

  it('sorts chapters by start and falls back to "Chapter N" for empty titles', () => {
    const out = buildEditMetadata(meta, [
      { startMs: 60000, title: '' },
      { startMs: 0, title: 'First' },
    ], 120000)
    const firstIdx = out.indexOf('title=First')
    const secondIdx = out.indexOf('title=Chapter 2')
    expect(firstIdx).toBeGreaterThan(-1)
    expect(secondIdx).toBeGreaterThan(firstIdx) // sorted: First (0) before Chapter 2 (60s)
  })

  it('omits narrator and year when empty', () => {
    const out = buildEditMetadata({ ...meta, narrator: '', year: '' }, chapters, 180000)
    expect(out).not.toContain('composer=')
    expect(out).not.toContain('date=')
  })

  it('escapes ffmetadata-reserved characters', () => {
    const out = buildEditMetadata({ ...meta, title: 'A = B; #1' }, [{ startMs: 0, title: 'C = D' }], 1000)
    expect(out).toContain('title=A \\= B\\; \\#1')
    expect(out).toContain('title=C \\= D')
  })
})

describe('buildEditMuxArgs', () => {
  const base = { input: 'in.m4b', coverPath: 'edit_cover.jpg', metaPath: 'meta.ffmeta', output: 'out.m4b' }

  it('keep: copies audio + existing cover and forces our chapters/metadata (index 1)', () => {
    const j = buildEditMuxArgs({ ...base, coverMode: 'keep' }).join(' ')
    expect(j).not.toContain('-i edit_cover.jpg')
    expect(j).toContain('-map 0:a')
    expect(j).toContain('-map 0:v?')
    expect(j).toContain('-c copy')
    expect(j).toContain('-map_metadata 1')
    expect(j).toContain('-map_chapters 1')
    expect(j).toContain('-metadata media_type=2')
  })

  it('replace: adds the cover input and shifts the metadata index to 2', () => {
    const j = buildEditMuxArgs({ ...base, coverMode: 'replace' }).join(' ')
    expect(j).toContain('-i edit_cover.jpg')
    expect(j).toContain('-map 1 -c:a copy -c:v mjpeg -disposition:v attached_pic')
    expect(j).toContain('-map_metadata 2')
    expect(j).toContain('-map_chapters 2')
  })

  it('remove: audio only, no video map', () => {
    const j = buildEditMuxArgs({ ...base, coverMode: 'remove' }).join(' ')
    expect(j).not.toContain('-map 0:v')
    expect(j).not.toContain('-map 1')
    expect(j).toContain('-c:a copy')
    expect(j).toContain('-map_chapters 1')
  })
})
