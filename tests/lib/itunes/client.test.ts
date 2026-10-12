import { describe, expect, it, vi } from 'vitest'
import {
  ItunesError,
  searchItunesCascade,
  type ItunesStage,
} from '@/lib/itunes/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeStagedFetch(stages: Response[]): ReturnType<typeof vi.fn<typeof fetch>> {
  let i = 0
  return vi.fn<typeof fetch>(async () => {
    const r = stages[i] ?? stages[stages.length - 1]
    i++
    // A copy: the last answer repeats, and a body can only be read once.
    return r.clone()
  })
}

const baseDoc = {
  collectionId: 1,
  collectionName: 'Title',
  artistName: 'Author',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/abc/100x100bb.jpg',
  releaseDate: '2012-09-25T07:00:00Z',
}

describe('searchItunesCascade — request shape', () => {
  it('builds the stage 1 term as "title author" and forces audiobook media + US country', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 1, results: [baseDoc] }),
    ])
    await searchItunesCascade({ title: 'The Hobbit', author: 'Tolkien', narrator: '', fetchImpl })
    const url = String(fetchImpl.mock.calls[0][0])
    expect(url).toContain('term=The+Hobbit+Tolkien')
    expect(url).toContain('media=audiobook')
    expect(url).toContain('country=US')
    expect(url).toContain('limit=10')
  })
})

describe('searchItunesCascade — happy path mapping', () => {
  it('maps API docs to ItunesResult, upgrading the artwork URL to 1200x1200', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 1, results: [baseDoc] }),
    ])
    const out = await searchItunesCascade({ title: 'x', fetchImpl })
    expect(out.stage).toBe(1)
    expect(out.results).toEqual([
      {
        key: 'itunes:1',
        title: 'Title',
        authors: ['Author'],
        year: '2012',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/abc/1200x1200bb.jpg',
      },
    ])
  })

  it('drops docs without a usable id or title', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({
        resultCount: 3,
        results: [
          { collectionId: 1 }, // no title → dropped
          { collectionName: 'OK', collectionId: 2, artistName: 'A' }, // kept
          { trackName: 'No id' }, // no id → dropped
        ],
      }),
    ])
    const out = await searchItunesCascade({ title: 'x', fetchImpl })
    expect(out.results).toHaveLength(1)
    expect(out.results[0].title).toBe('OK')
  })
})

describe('searchItunesCascade — cascade behaviour', () => {
  it('falls through to stage 2 when stage 1 has no results, and uses narrator in the term', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 1, results: [{ ...baseDoc, collectionName: 'T' }] }),
    ])
    const stages: ItunesStage[] = []
    const out = await searchItunesCascade({
      title: 'T',
      author: 'A',
      narrator: 'Narr',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(2)
    expect(stages).toEqual([1, 2])
    const stage2Url = String(fetchImpl.mock.calls[1][0])
    expect(stage2Url).toContain('term=T+Narr')
  })

  it('skips stage 2 when narrator is empty and goes to stage 3', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 1, results: [baseDoc] }),
    ])
    const stages: ItunesStage[] = []
    const out = await searchItunesCascade({
      title: 'T',
      author: 'A',
      narrator: '   ',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(3)
    expect(stages).toEqual([1, 3])
    const stage3Url = String(fetchImpl.mock.calls[1][0])
    expect(stage3Url).toContain('term=T')
  })

  it('throws no-results when every stage is empty', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 0, results: [] }),
    ])
    await expect(
      searchItunesCascade({ title: 'T', author: 'A', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'no-results' })
  })

  it('propagates non-no-results errors', async () => {
    const fetchImpl = makeStagedFetch([new Response('', { status: 429 })])
    await expect(
      searchItunesCascade({ title: 'T', author: 'A', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'rate-limit' })
  })

  it('throws when title, author, and narrator are all blank', async () => {
    const fetchImpl = vi.fn()
    await expect(
      searchItunesCascade({ title: '', author: '', narrator: '', fetchImpl })
    ).rejects.toBeInstanceOf(ItunesError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('searchItunesCascade — finding the book', () => {
  // What iTunes answered on 2026-10-12 for the title with "Joanne K. Rowling" (iTunes knows her
  // as "J.K. Rowling"), and for the title alone.
  const withFullName = jsonResponse({
    resultCount: 3,
    results: [
      { collectionId: 11, collectionName: 'A Pen to Change the World: The Life of J.K. Rowling (Unabridged)', artistName: 'Solomon Schmidt' },
      { collectionId: 12, collectionName: 'Joanne K. Rowling: Kurzbiografie kompakt', artistName: '5 Minuten Biografien' },
      { collectionId: 13, collectionName: 'Still I Rise: The Persistence of Phenomenal Women', artistName: 'Marlene Wagman-Geller' },
    ],
  })
  const titleAlone = jsonResponse({
    resultCount: 4,
    results: [
      { collectionId: 21, collectionName: 'Harry Potter and the Half-Blood Prince by J.K. Rowling (Book Analysis)', artistName: 'Bright Summaries' },
      { collectionId: 22, collectionName: 'Harry Windzor and the Magic of Monarchy: A Potter Parody', artistName: 'Sid Ishun' },
      { collectionId: 23, collectionName: 'Harry Potter et le Prince de Sang-Mêlé', artistName: 'J.K. Rowling' },
      { collectionId: 24, collectionName: 'Harry Potter and the Half-Blood Prince', artistName: 'J.K. Rowling' },
    ],
  })

  it('searches people by surname', async () => {
    const fetchImpl = makeStagedFetch([titleAlone])
    await searchItunesCascade({ title: 'Harry Potter and the Half-Blood Prince', author: 'Joanne K. Rowling', fetchImpl })
    expect(String(fetchImpl.mock.calls[0][0])).toContain('term=Harry+Potter+and+the+Half-Blood+Prince+Rowling')
  })

  it('goes on when a stage finds only other books, and puts the book first', async () => {
    const fetchImpl = makeStagedFetch([withFullName, titleAlone])
    const stages: ItunesStage[] = []
    const out = await searchItunesCascade({
      title: 'Harry Potter and the Half-Blood Prince',
      author: 'Joanne K. Rowling',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(stages).toEqual([1, 3])
    expect(out.matched).toBe(true)
    expect(out.stage).toBe(3)
    expect(out.results.slice(0, 3).map((r) => r.title)).toEqual([
      'Harry Potter and the Half-Blood Prince',
      'Harry Potter et le Prince de Sang-Mêlé',
      'Harry Potter and the Half-Blood Prince by J.K. Rowling (Book Analysis)',
    ])
    expect(out.results.slice(-3).map((r) => r.title)).toContain('A Pen to Change the World: The Life of J.K. Rowling (Unabridged)')
  })

  it('stops at the first stage that looks like the book; part of the title is enough', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ resultCount: 1, results: [{ collectionId: 1, collectionName: 'Harry Potter and the Goblet of Fire', artistName: 'J.K. Rowling' }] }),
    ])
    const out = await searchItunesCascade({ title: 'Goblet of Fire', fetchImpl })
    expect(out.matched).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
