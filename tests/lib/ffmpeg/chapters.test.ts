import { describe, expect, it } from 'vitest'
import { buildChapters, buildFFMetadata } from '@/lib/ffmpeg/chapters'

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
