import { describe, expect, it } from 'vitest'
import { numberedTitles, replaceInTitles, stripSharedText, titlesLeftEmpty } from '@/lib/audio/chapterTitles'

describe('replaceInTitles', () => {
  it('replaces plain text in every title, ignoring case', () => {
    expect(replaceInTitles(['Chapter 1', 'CHAPTER 2', 'Epilogue'], 'chapter', 'Part', false)).toEqual([
      'Part 1',
      'Part 2',
      'Epilogue',
    ])
  })

  it('can match case', () => {
    expect(replaceInTitles(['Chapter 1', 'CHAPTER 2'], 'Chapter', 'Part', true)).toEqual(['Part 1', 'CHAPTER 2'])
  })

  it('treats the text as text, not a pattern', () => {
    expect(replaceInTitles(['Part (1)', 'Part 1'], '(1)', 'one', false)).toEqual(['Part one', 'Part 1'])
    expect(replaceInTitles(['a.b', 'axb'], '.', '-', false)).toEqual(['a-b', 'axb'])
    expect(replaceInTitles(['Price $1'], '$1', '$2', false)).toEqual(['Price $2'])
  })

  it('tidies what a removal leaves behind', () => {
    expect(replaceInTitles(['The Hobbit - Chapter 1', 'Chapter 2 - The Hobbit'], 'The Hobbit', '', false)).toEqual([
      'Chapter 1',
      'Chapter 2',
    ])
    expect(replaceInTitles(['Intro  (Unabridged)  part'], '(Unabridged)', '', false)).toEqual(['Intro part'])
  })

  it('keeps a title it would leave empty, and does nothing without text to find', () => {
    expect(replaceInTitles(['Track', 'Track 2'], 'Track', '', false)).toEqual(['Track', '2'])
    const titles = ['A', 'B']
    expect(replaceInTitles(titles, '', 'x', false)).toBe(titles)
  })

  it("leaves a full stop at a title's start alone", () => {
    expect(replaceInTitles(['...And Then There Were None (x)'], ' (x)', '', false)).toEqual(['...And Then There Were None'])
  })
})

describe('stripSharedText', () => {
  it('removes the text every title starts with, up to a separator', () => {
    expect(stripSharedText(['Harry Potter 1 - Chapter One', 'Harry Potter 1 - Chapter Two'])).toEqual({
      prefix: 'Harry Potter 1 - ',
      suffix: '',
      titles: ['Chapter One', 'Chapter Two'],
    })
  })

  it('keeps a shared word that has no separator after it', () => {
    // "Book 1 - Chapter 01" … "Chapter 10": the shared "Chapter " stays.
    const titles = ['Book 1 - Chapter 01', 'Book 1 - Chapter 02', 'Book 1 - Chapter 10']
    expect(stripSharedText(titles)?.titles).toEqual(['Chapter 01', 'Chapter 02', 'Chapter 10'])
    expect(stripSharedText(['Chapter 1', 'Chapter 2'])).toBeNull()
  })

  it('removes the text every title ends with, from a separator', () => {
    expect(stripSharedText(['Intro (Unabridged)', 'The Road (Unabridged)'])).toEqual({
      prefix: '',
      suffix: ' (Unabridged)',
      titles: ['Intro', 'The Road'],
    })
    expect(stripSharedText(['Chapter 1 - The Hobbit', 'Chapter 2 - The Hobbit'])?.titles).toEqual(['Chapter 1', 'Chapter 2'])
  })

  it('removes both ends at once', () => {
    expect(stripSharedText(['[Book] Intro (Unabridged)', '[Book] Outro (Unabridged)'])).toEqual({
      prefix: '[Book] ',
      suffix: ' (Unabridged)',
      titles: ['Intro', 'Outro'],
    })
  })

  it('removes nothing that would leave a title empty or two the same', () => {
    expect(stripSharedText(['Book - A', 'Book - A'])).toBeNull()
    expect(stripSharedText(['Book - ', 'Book - B'])).toBeNull()
    expect(stripSharedText(['One title - x'])).toBeNull()
  })
})

describe('numberedTitles', () => {
  it('numbers the chapters from one', () => {
    expect(numberedTitles(3)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3'])
    expect(numberedTitles(2, 'Part')).toEqual(['Part 1', 'Part 2'])
  })
})

describe('titlesLeftEmpty', () => {
  it('counts the titles the replacement would leave empty, which therefore stay', () => {
    const titles = ['Book - End', 'Book - Start', 'Other']
    expect(titlesLeftEmpty(titles, 'Book - End', '', false)).toBe(1)
    expect(titlesLeftEmpty(titles, 'book - ', '', false)).toBe(0)
    expect(titlesLeftEmpty(['- Book -', 'Book'], 'book', '', false)).toBe(2) // only separators would be left
  })

  it('is 0 without text to find, or when the text gets something in its place', () => {
    expect(titlesLeftEmpty(['A'], '', '', false)).toBe(0)
    expect(titlesLeftEmpty(['A'], 'A', 'B', false)).toBe(0)
  })
})

