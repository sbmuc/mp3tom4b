import { describe, expect, it } from 'vitest'
import { buildChapters, buildFFMetadata, buildGlobalMetadata } from '@/lib/ffmpeg/chapters'

describe('buildChapters', () => {
  it('produces a contiguous timeline starting at 0', () => {
    const chapters = buildChapters([
      { title: 'Intro', durationMs: 10_000 },
      { title: 'One', durationMs: 60_000 },
      { title: 'Two', durationMs: 90_000 },
    ])
    expect(chapters).toEqual([
      { title: 'Intro', startMs: 0, endMs: 10_000 },
      { title: 'One', startMs: 10_000, endMs: 70_000 },
      { title: 'Two', startMs: 70_000, endMs: 160_000 },
    ])
  })

  it('returns empty for empty input', () => {
    expect(buildChapters([])).toEqual([])
  })

  it('handles a single chapter', () => {
    expect(buildChapters([{ title: 'Only', durationMs: 5000 }])).toEqual([
      { title: 'Only', startMs: 0, endMs: 5000 },
    ])
  })

  it('preserves zero-length segments without breaking the timeline', () => {
    const chapters = buildChapters([
      { title: 'First', durationMs: 1000 },
      { title: 'Empty', durationMs: 0 },
      { title: 'Third', durationMs: 2000 },
    ])
    expect(chapters[1]).toEqual({ title: 'Empty', startMs: 1000, endMs: 1000 })
    expect(chapters[2]).toEqual({ title: 'Third', startMs: 1000, endMs: 3000 })
  })
})

describe('buildFFMetadata', () => {
  it('starts with the FFMETADATA1 header and ends with a trailing newline', () => {
    const out = buildFFMetadata([{ title: 'A', startMs: 0, endMs: 1000 }])
    expect(out.startsWith(';FFMETADATA1\n')).toBe(true)
    expect(out.endsWith('\n')).toBe(true)
  })

  it('emits one [CHAPTER] section per chapter with the right keys', () => {
    const out = buildFFMetadata([
      { title: 'A', startMs: 0, endMs: 1000 },
      { title: 'B', startMs: 1000, endMs: 2500 },
    ])
    const sectionCount = (out.match(/\[CHAPTER\]/g) || []).length
    expect(sectionCount).toBe(2)
    expect(out).toContain('TIMEBASE=1/1000')
    expect(out).toContain('START=0')
    expect(out).toContain('END=1000')
    expect(out).toContain('START=1000')
    expect(out).toContain('END=2500')
    expect(out).toContain('title=A')
    expect(out).toContain('title=B')
  })

  it('escapes ffmetadata-reserved characters in titles', () => {
    const out = buildFFMetadata([
      { title: 'Hello = World; #1\\path\nnewline', startMs: 0, endMs: 1 },
    ])
    expect(out).toContain('title=Hello \\= World\\; \\#1\\\\path\\\nnewline')
  })

  it('produces just the header for an empty list', () => {
    expect(buildFFMetadata([])).toBe(';FFMETADATA1\n')
  })
})

describe('buildFFMetadata — fractional times', () => {
  it('rounds measured (fractional) chapter times to whole ms', () => {
    const body = buildFFMetadata(buildChapters([
      { title: 'A', durationMs: 3343.6734 },
      { title: 'B', durationMs: 2500.4 },
    ]))
    expect(body).toContain('START=0\nEND=3344\n')
    expect(body).toContain('START=3344\nEND=5844\n')
  })
})

describe('buildGlobalMetadata', () => {
  const base = { title: 'The Book', author: 'An Author', narrator: '', year: '', genre: 'Audiobook' as const }

  it('writes title/artist/album/album_artist/genre and skips empty optionals', () => {
    expect(buildGlobalMetadata(base)).toEqual([
      'title=The Book',
      'artist=An Author',
      'album=The Book',
      'album_artist=An Author',
      'genre=Audiobook',
    ])
  })

  it('adds narrator as composer and year as date', () => {
    const lines = buildGlobalMetadata({ ...base, narrator: 'A Narrator', year: '2024' })
    expect(lines).toContain('composer=A Narrator')
    expect(lines).toContain('date=2024')
  })

  it('escapes backslash, ;, =, # and newlines so they survive ffmpeg', () => {
    const lines = buildGlobalMetadata({ ...base, title: 'AC\\DC Live; Part=1 #2\nx' })
    expect(lines[0]).toBe('title=AC\\\\DC Live\\; Part\\=1 \\#2\\\nx')
  })
})
