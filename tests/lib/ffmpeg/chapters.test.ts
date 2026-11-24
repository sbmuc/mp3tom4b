import { describe, expect, it } from 'vitest'
import { buildChapters, buildFFMetadata, buildGlobalMetadata, globalTagLines, otherTagLines, replaceChapters } from '@/lib/ffmpeg/chapters'
import { EMPTY_METADATA } from '@/types'

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
  const base = { ...EMPTY_METADATA, title: 'The Book', author: 'An Author' }

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

  it('writes the description as both descriptions, and the series where Audiobookshelf reads it', () => {
    const lines = buildGlobalMetadata({
      ...base,
      description: '  A hobbit goes there.\n\nAnd back again.  ',
      series: ' Middle-earth ',
      seriesPart: ' 1 ',
    })
    expect(lines).toContain('description=A hobbit goes there.\\\n\\\nAnd back again.')
    expect(lines).toContain('synopsis=A hobbit goes there.\\\n\\\nAnd back again.')
    expect(lines).toContain('show=Middle-earth')
    expect(lines).toContain('episode_id=1')
  })

  it("writes Windows line ends in a description as ffmetadata's own", () => {
    const lines = buildGlobalMetadata({ ...base, description: 'One.\r\nTwo.' })
    expect(lines).toContain('description=One.\\\nTwo.')
  })

  it('leaves out an empty description and series, and blank ones', () => {
    const lines = buildGlobalMetadata({ ...base, description: '  ', series: '', seriesPart: ' ' })
    expect(lines.some((l) => /^(description|synopsis|show|episode_id)=/.test(l))).toBe(false)
  })
})

describe('replaceChapters', () => {
  const dump = [
    ';FFMETADATA1',
    'major_brand=M4A ',
    'title=AC\\\\DC Live\\; Part 1',
    'encoder=Lavf59.27.100',
    '',
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    'START=0',
    'END=3344',
    'title=Old one',
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    'START=3344',
    'END=8081',
    'title=Old two',
    '',
  ].join('\n')

  it('keeps the global tags verbatim and swaps in the new chapter blocks', () => {
    const out = replaceChapters(dump, [
      { title: 'One', startMs: 0, endMs: 3390.11 },
      { title: 'Two; again', startMs: 3390.11, endMs: 8150.2 },
    ])
    expect(out.startsWith(';FFMETADATA1\nmajor_brand=M4A \ntitle=AC\\\\DC Live\\; Part 1\nencoder=Lavf59.27.100\n')).toBe(true)
    expect(out).not.toContain('Old one')
    expect(out).toContain('START=3390\nEND=8150\ntitle=Two\\; again\n')
    expect(out.match(/\[CHAPTER\]/g)).toHaveLength(2)
  })

  it('adds chapter blocks to a dump that had none', () => {
    const out = replaceChapters(';FFMETADATA1\ntitle=Book\n', [{ title: 'Only', startMs: 0, endMs: 1000 }])
    expect(out).toBe(';FFMETADATA1\ntitle=Book\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000\ntitle=Only\n')
  })
})

describe('buildGlobalMetadata — date and disc', () => {
  it('writes a full release date as it is', () => {
    expect(buildGlobalMetadata({ ...EMPTY_METADATA, year: '2024-04-03' })).toContain('date=2024-04-03')
  })

  it('writes a disc number only when it is one', () => {
    expect(buildGlobalMetadata({ ...EMPTY_METADATA, disc: '2' })).toContain('disc=2')
    expect(buildGlobalMetadata({ ...EMPTY_METADATA, disc: ' 1 / 2 ' })).toContain('disc=1/2')
    expect(buildGlobalMetadata({ ...EMPTY_METADATA, disc: '3/2' }).some((l) => l.startsWith('disc='))).toBe(false)
    expect(buildGlobalMetadata(EMPTY_METADATA).some((l) => l.startsWith('disc='))).toBe(false)
  })
})

describe('globalTagLines / otherTagLines', () => {
  // As `ffmpeg -i book.m4b -f ffmetadata` writes it: escapes, an escaped line
  // break inside a value, then the chapters.
  const DUMP = [
    ';FFMETADATA1',
    'major_brand=isom',
    'title=Spellforge \; Book \\= 2',
    'artist=Logan Jacobs',
    'date=2024-04-03',
    'disc=2',
    'track=1/1',
    'comment=Line one\\',
    'line two',
    'copyright=2024 Someone',
    'sort_name=Spellforge 2',
    'encoder=Lavf59.27.100',
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    'START=0',
    'END=1000',
    'title=Chapter 1',
    '',
  ].join('\n')

  it('reads the book-level tags with their lines as written, up to the first section', () => {
    const tags = globalTagLines(DUMP)
    expect(tags.map((t) => t.key)).toEqual([
      'major_brand', 'title', 'artist', 'date', 'disc', 'track', 'comment', 'copyright', 'sort_name', 'encoder',
    ])
    expect(tags.find((t) => t.key === 'title')?.line).toBe('title=Spellforge \; Book \\= 2')
    expect(tags.find((t) => t.key === 'comment')?.line).toBe('comment=Line one\\\nline two')
  })

  it('keeps only the tags the book details do not set', () => {
    expect(otherTagLines(DUMP)).toEqual(['track=1/1', 'comment=Line one\\\nline two', 'copyright=2024 Someone', 'sort_name=Spellforge 2'])
  })

  it('reads Windows line ends, and nothing from a dump without tags', () => {
    expect(otherTagLines(';FFMETADATA1\r\ncomment=Hi\r\n')).toEqual(['comment=Hi'])
    expect(otherTagLines(';FFMETADATA1\n')).toEqual([])
    expect(otherTagLines('')).toEqual([])
  })
})
