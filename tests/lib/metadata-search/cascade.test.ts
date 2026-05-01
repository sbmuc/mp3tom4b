import { describe, expect, it, vi } from 'vitest'
import {
  MetadataSearchError,
  searchAllSources,
  type CascadeStageId,
} from '@/lib/metadata-search/cascade'

const ITUNES_HOST = 'itunes.apple.com'
const OL_HOST = 'openlibrary.org'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface RoutedResponses {
  itunes: Response[]
  openlibrary: Response[]
}

function routedFetch(routes: RoutedResponses): ReturnType<typeof vi.fn<typeof fetch>> {
  let i = 0
  let j = 0
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.includes(ITUNES_HOST)) {
      const r = routes.itunes[i] ?? routes.itunes[routes.itunes.length - 1]
      i++
      return r
    }
    if (url.includes(OL_HOST)) {
      const r = routes.openlibrary[j] ?? routes.openlibrary[routes.openlibrary.length - 1]
      j++
      return r
    }
    throw new Error(`Unexpected URL: ${url}`)
  })
}

const itunesDoc = {
  collectionId: 42,
  collectionName: 'Foo',
  artistName: 'Bar',
  artworkUrl100: 'https://x/100x100bb.jpg',
  releaseDate: '2020-01-01T00:00:00Z',
}

const olDoc = {
  key: '/works/OL1',
  title: 'Foo',
  author_name: ['Bar'],
  first_publish_year: 2020,
}

describe('searchAllSources — source priority', () => {
  it('returns iTunes results without ever hitting Open Library', async () => {
    const fetchImpl = routedFetch({
      itunes: [jsonResponse({ resultCount: 1, results: [itunesDoc] })],
      openlibrary: [jsonResponse({ docs: [olDoc] })],
    })
    const stages: CascadeStageId[] = []
    const out = await searchAllSources({
      title: 'Foo',
      author: 'Bar',
      narrator: '',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe('itunes-1')
    expect(out.results[0]).toMatchObject({ source: 'itunes' })
    expect(stages).toEqual(['itunes-1'])
    // Open Library was never called.
    const olCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes(OL_HOST))
    expect(olCalls).toHaveLength(0)
  })

  it('falls through to Open Library when every iTunes stage is empty', async () => {
    const fetchImpl = routedFetch({
      itunes: [
        jsonResponse({ resultCount: 0, results: [] }),
        jsonResponse({ resultCount: 0, results: [] }),
        jsonResponse({ resultCount: 0, results: [] }),
      ],
      openlibrary: [jsonResponse({ docs: [olDoc] })],
    })
    const stages: CascadeStageId[] = []
    const out = await searchAllSources({
      title: 'Foo',
      author: 'Bar',
      narrator: 'N',
      fetchImpl,
      onStageStart: (s) => stages.push(s),
    })
    expect(out.stage).toBe('openlibrary-1')
    expect(out.results[0]).toMatchObject({ source: 'openlibrary' })
    expect(stages).toEqual(['itunes-1', 'itunes-2', 'itunes-3', 'openlibrary-1'])
  })

  it('propagates a non-no-results iTunes error and does not fall back', async () => {
    const fetchImpl = routedFetch({
      itunes: [new Response('', { status: 429 })],
      openlibrary: [jsonResponse({ docs: [olDoc] })],
    })
    await expect(
      searchAllSources({ title: 'Foo', author: 'Bar', narrator: 'N', fetchImpl })
    ).rejects.toMatchObject({ kind: 'rate-limit' })
    const olCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes(OL_HOST))
    expect(olCalls).toHaveLength(0)
  })

  it('throws MetadataSearchError(no-results) when every stage of both sources is empty', async () => {
    const empty = [
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 0, results: [] }),
      jsonResponse({ resultCount: 0, results: [] }),
    ]
    const olEmpty = [jsonResponse({ docs: [] }), jsonResponse({ docs: [] }), jsonResponse({ docs: [] })]
    const fetchImpl = routedFetch({ itunes: empty, openlibrary: olEmpty })
    await expect(
      searchAllSources({ title: 'Foo', author: 'Bar', narrator: 'N', fetchImpl })
    ).rejects.toBeInstanceOf(MetadataSearchError)
  })

  it('throws when input is fully blank without making any request', async () => {
    const fetchImpl = vi.fn()
    await expect(
      searchAllSources({ title: '', author: '', narrator: '', fetchImpl })
    ).rejects.toBeInstanceOf(MetadataSearchError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
