import { describe, expect, it } from 'vitest'
import { fileNameToChapterTitle } from '@/lib/audio/format'

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
