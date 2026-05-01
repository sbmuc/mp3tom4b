import { describe, expect, it, vi } from 'vitest'
import {
  OpenLibraryError,
  searchBooks,
  searchBooksCascade,
  type SearchStage,
} from '@/lib/openlibrary/client'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('searchBooks — request shape', () => {
  it('encodes title and author into the search URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ docs: [{ key: '/works/OL1', title: 'X', author_name: ['Y'] }] })
    )
    await searchBooks({ title: 'The Hobbit', author: 'Tolkien', fetchImpl })
    const calledUrl = String(fetchImpl.mock.calls[0][0])
    expect(calledUrl).toContain('title=The+Hobbit')
    expect(calledUrl).toContain('author=Tolkien')
    expect(calledUrl).toContain('limit=5')
    expect(calledUrl).toContain('fields=title%2Cauthor_name%2Cfirst_publish_year%2Ckey')
  })

  it('omits the field that is empty / whitespace', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse({ docs: [{ key: '/k', title: 'T', author_name: ['A'] }] })
    )
    await searchBooks({ title: '  ', author: 'Tolkien', fetchImpl })
    const calledUrl = String(fetchImpl.mock.calls[0][0])
    expect(calledUrl).not.toContain('title=')
    expect(calledUrl).toContain('author=Tolkien')
  })

  it('throws when both title and author are blank', async () => {
    const fetchImpl = vi.fn()
    await expect(searchBooks({ title: '', author: '   ', fetchImpl })).rejects.toBeInstanceOf(OpenLibraryError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('searchBooks — happy path mapping', () => {
  it('returns up to 5 docs with year stringified', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        docs: [
          { key: '/works/OL1', title: 'A', author_name: ['Author A'], first_publish_year: 1990 },
          { key: '/works/OL2', title: 'B', author_name: ['Author B', 'Co-Author'] },
        ],
      })
    )
    const out = await searchBooks({ title: 'x', fetchImpl })
    expect(out).toEqual([
      { key: '/works/OL1', title: 'A', authors: ['Author A'], year: '1990' },
      { key: '/works/OL2', title: 'B', authors: ['Author B', 'Co-Author'], year: undefined },
    ])
  })

  it('caps results at 5 even when API returns more', async () => {
    const docs = Array.from({ length: 12 }, (_, i) => ({
      key: `/works/OL${i}`,
      title: `T${i}`,
      author_name: ['A'],
    }))
    const fetchImpl = vi.fn(async () => jsonResponse({ docs }))
    const out = await searchBooks({ title: 'x', fetchImpl })
    expect(out).toHaveLength(5)
  })

  it('falls back to "Untitled" / "Unknown author" when fields missing', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ docs: [{ key: '/works/OLx' }] })
    )
    const [doc] = await searchBooks({ title: 'x', fetchImpl })
    expect(doc.title).toBe('Untitled')
    expect(doc.authors).toEqual([])
  })
})

describe('searchBooks — error mapping', () => {
  it('maps a network failure to OpenLibraryError(network)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(searchBooks({ title: 'x', fetchImpl })).rejects.toMatchObject({
      name: 'OpenLibraryError',
      kind: 'network',
    })
  })

  it('maps HTTP 429 to OpenLibraryError(rate-limit)', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 429 }))
    await expect(searchBooks({ title: 'x', fetchImpl })).rejects.toMatchObject({
      kind: 'rate-limit',
    })
  })

  it('maps an empty docs array to OpenLibraryError(no-results)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ docs: [] }))
    await expect(searchBooks({ title: 'x', fetchImpl })).rejects.toMatchObject({
      kind: 'no-results',
    })
  })

  it('maps non-OK non-429 to OpenLibraryError(unknown)', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }))
    await expect(searchBooks({ title: 'x', fetchImpl })).rejects.toMatchObject({
      kind: 'unknown',
    })
  })

  it('rethrows AbortError without wrapping', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(searchBooks({ title: 'x', fetchImpl })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})

describe('searchBooksCascade', () => {
  function makeStagedFetch(stageResponses: Response[]): ReturnType<typeof vi.fn<typeof fetch>> {
    let i = 0
    return vi.fn<typeof fetch>(async () => {
      const r = stageResponses[i] ?? stageResponses[stageResponses.length - 1]
      i++
      return r
    })
  }

  it('returns immediately at stage 1 when results are found', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ docs: [{ key: '/k', title: 'T', author_name: ['A'] }] }),
    ])
    const stages: SearchStage[] = []
    const out = await searchBooksCascade({
      title: 'T',
      author: 'A',
      narrator: 'N',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(1)
    expect(out.results).toHaveLength(1)
    expect(stages).toEqual([1])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls through to stage 2 when stage 1 has no results', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [{ key: '/k', title: 'T', author_name: ['N'] }] }),
    ])
    const stages: SearchStage[] = []
    const out = await searchBooksCascade({
      title: 'T',
      author: 'A',
      narrator: 'N',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(2)
    expect(stages).toEqual([1, 2])
    // Stage 2 should have used narrator as the author parameter.
    const stage2Url = String(fetchImpl.mock.calls[1][0])
    expect(stage2Url).toContain('author=N')
  })

  it('skips stage 2 and goes straight to stage 3 when narrator is empty', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [{ key: '/k', title: 'T', author_name: [] }] }),
    ])
    const stages: SearchStage[] = []
    const out = await searchBooksCascade({
      title: 'T',
      author: 'A',
      narrator: '   ',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(3)
    expect(stages).toEqual([1, 3])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const stage3Url = String(fetchImpl.mock.calls[1][0])
    expect(stage3Url).toContain('title=T')
    expect(stage3Url).not.toContain('author=')
  })

  it('reaches stage 3 after stages 1 and 2 are empty', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [{ key: '/k', title: 'T', author_name: ['Z'] }] }),
    ])
    const stages: SearchStage[] = []
    const out = await searchBooksCascade({
      title: 'T',
      author: 'A',
      narrator: 'N',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe(3)
    expect(stages).toEqual([1, 2, 3])
  })

  it('throws no-results when every applicable stage is empty', async () => {
    const fetchImpl = makeStagedFetch([
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [] }),
      jsonResponse({ docs: [] }),
    ])
    await expect(
      searchBooksCascade({ title: 'T', author: 'A', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'no-results' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not re-run stage 3 when title is empty (only stage 1 fires)', async () => {
    const fetchImpl = makeStagedFetch([jsonResponse({ docs: [] })])
    await expect(
      searchBooksCascade({ title: '', author: 'A', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'no-results' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('propagates non-no-results errors from any stage immediately', async () => {
    const fetchImpl = makeStagedFetch([new Response('', { status: 429 })])
    await expect(
      searchBooksCascade({ title: 'T', author: 'A', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'rate-limit' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws when title, author, and narrator are all blank', async () => {
    const fetchImpl = vi.fn()
    await expect(
      searchBooksCascade({ title: '', author: '', narrator: '', fetchImpl })
    ).rejects.toBeInstanceOf(OpenLibraryError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
