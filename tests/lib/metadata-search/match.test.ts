import { describe, expect, it } from 'vitest'
import { coverage, looksLikeTheBook, rankResults, relevance, samePerson, surname, titleWords } from '@/lib/metadata-search/match'

describe('surname', () => {
  it.each([
    ['Joanne K. Rowling', 'Rowling'],
    ['J.K. Rowling', 'Rowling'],
    ['J.K.Rowling', 'Rowling'],
    ['Rowling, J. K.', 'Rowling'],
    ['Tolkien, J.R.R.', 'Tolkien'],
    ['Rowling, Joanne', 'Rowling'],
    ['Terry Pratchett & Neil Gaiman', 'Pratchett'],
    ['Annie M.G. Schmidt en Fiep Westendorp', 'Schmidt'],
    ['J. K. Rowling, Stephen Fry', 'Rowling'],
    ['Martin Luther King Jr.', 'King'],
    ['Plato', 'Plato'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(surname(name)).toBe(expected)
  })
})

describe('samePerson', () => {
  it.each([
    ['Joanne K. Rowling', 'J.K. Rowling'],
    ['J. K. Rowling', 'Rowling, J. K.'],
    ['Joanne Rowling', 'J.K. Rowling'],
    ['J.R.R. Tolkien', 'Tolkien, J.R.R.'],
    ['Gabriel García Márquez', 'Gabriel Garcia Marquez'],
    ['Stephen Fry', 'stephen fry'],
  ])('%s is %s', (a, b) => {
    expect(samePerson(a, b)).toBe(true)
  })

  it.each([
    ['Jim Dale', 'J.K. Rowling'],
    ['Stephen Fry', 'Jim Dale'],
    ['Joanne K. Rowling', 'Kevin Rowling'],
    ['', ''],
  ])('%s is not %s', (a, b) => {
    expect(samePerson(a, b)).toBe(false)
  })
})

describe('titles', () => {
  it('compares telling words, without accents, case, articles or "Unabridged"', () => {
    expect(titleWords('The Café — Deux (Unabridged)')).toEqual(['cafe', 'deux'])
    expect(titleWords('日本語の章')).toEqual(['日本語の章'])
    expect(coverage('Harry Potter en de Halfbloed Prins', 'Halfbloed Prins')).toBe(1)
    expect(coverage('Café — Deux', 'cafe deux')).toBe(1)
  })

  it('a result looks like the book when it has most of the title, or any result when there is no title', () => {
    expect(looksLikeTheBook(['Harry Potter and the Goblet of Fire'], 'Goblet of Fire')).toBe(true)
    expect(looksLikeTheBook(['A Pen to Change the World: The Life of J.K. Rowling'], 'Harry Potter and the Half-Blood Prince')).toBe(false)
    expect(looksLikeTheBook(['Anything'], '')).toBe(true)
    expect(looksLikeTheBook([], '')).toBe(false)
  })
})

describe('ranking', () => {
  const title = 'Harry Potter and the Half-Blood Prince'
  const people = ['Joanne K. Rowling', '']

  it('the book above an analysis of it, above a biography of its author', () => {
    const book = relevance({ title: 'Harry Potter and the Half-Blood Prince (Unabridged)', authors: ['J.K. Rowling'] }, title, people)
    const analysis = relevance(
      { title: 'Harry Potter and the Half-Blood Prince by J.K. Rowling (Book Analysis)', authors: ['Bright Summaries'] },
      title,
      people
    )
    const biography = relevance({ title: 'A Pen to Change the World: The Life of J.K. Rowling', authors: ['Solomon Schmidt'] }, title, people)
    expect(book).toBeGreaterThan(analysis)
    expect(analysis).toBeGreaterThan(biography)
  })

  it('keeps each result once, and the order found for equal scores', () => {
    const item = (key: string, resultTitle: string) => ({ result: { key, title: resultTitle, authors: [] as string[] }, stage: key })
    const ranked = rankResults([item('a', 'Other'), item('b', title), item('a', 'Other'), item('c', 'Another')], title, people)
    expect(ranked.map((r) => r.result.key)).toEqual(['b', 'a', 'c'])
  })
})
