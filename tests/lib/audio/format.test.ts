import { describe, expect, it } from 'vitest'
import { fileNameToChapterTitle, stripTrackNumbers } from '@/lib/audio/format'

describe('fileNameToChapterTitle', () => {
  it('capitalizes only the first letter (sentence case, not Title Case)', () => {
    expect(fileNameToChapterTitle('de reis naar het westen.wav')).toBe('De reis naar het westen')
  })

  it('preserves intentional capitals instead of down/upper-casing every word', () => {
    expect(fileNameToChapterTitle('DE TERUGKEER.wav')).toBe('DE TERUGKEER')
    expect(fileNameToChapterTitle('deel 4 - van der Meer.wav')).toBe('Deel 4 van der Meer')
  })

  it('does not capitalize after a leading apostrophe', () => {
    expect(fileNameToChapterTitle("'s ochtends vroeg.wav")).toBe("'s ochtends vroeg")
  })

  it('collapses whitespace left by removed separators (no triple space)', () => {
    expect(fileNameToChapterTitle('deel 4 - van der Meer.wav')).not.toContain('  ')
    expect(fileNameToChapterTitle('chapter___one.mp3')).toBe('Chapter one')
  })

  it('turns underscores and hyphens into single spaces', () => {
    expect(fileNameToChapterTitle('chapter_01.mp3')).toBe('Chapter 01')
    expect(fileNameToChapterTitle('part-one-intro.flac')).toBe('Part one intro')
  })
})

describe('stripTrackNumbers', () => {
  it('drops the numbers when every title has one', () => {
    expect(stripTrackNumbers(['01 - The Happy Prince', '02 - The Nightingale and The Rose', '03 - The Selfish Giant'])).toEqual([
      'The Happy Prince',
      'The Nightingale and The Rose',
      'The Selfish Giant',
    ])
    expect(stripTrackNumbers(['1. Introduction', '2. The Road', '10. Home'])).toEqual(['Introduction', 'The Road', 'Home'])
    expect(stripTrackNumbers(['01 The Beginning', '02 Into the Woods'])).toEqual(['The Beginning', 'Into the Woods'])
    expect(stripTrackNumbers(['01 – opening', '02 – closing'])).toEqual(['Opening', 'Closing'])
  })

  it('keeps the titles when one has no number', () => {
    const titles = ['01 - Prologue', 'Interlude', '02 - Epilogue']
    expect(stripTrackNumbers(titles)).toBe(titles)
  })

  it('keeps a number that is part of a name', () => {
    expect(stripTrackNumbers(['1984', 'Animal Farm'])).toEqual(['1984', 'Animal Farm'])
    expect(stripTrackNumbers(['1984 - Part One', '1984 - Part Two'])).toEqual(['1984 - Part One', '1984 - Part Two'])
  })

  it('keeps titles that are only a number, or repeat one', () => {
    expect(stripTrackNumbers(['01', '02'])).toEqual(['01', '02'])
    expect(stripTrackNumbers(['1 - Part A', '1 - Part B'])).toEqual(['1 - Part A', '1 - Part B'])
  })

  it('leaves a single file alone', () => {
    expect(stripTrackNumbers(['01 - Only Chapter'])).toEqual(['01 - Only Chapter'])
  })
})
