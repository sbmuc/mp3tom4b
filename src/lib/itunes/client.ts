/**
 * Tiny client for the iTunes Search API, audiobook media type.
 * https://performance-partners.apple.com/search-api
 *
 * Privacy: only the title / author / narrator strings the user typed are
 * sent (assembled into a single search term). No audio data, no covers,
 * no user identifiers. Country forced to US for the deepest catalog.
 */

const BASE_URL = 'https://itunes.apple.com/search'
const RESULT_LIMIT = 10
const COUNTRY = 'US'

export interface ItunesResult {
  /** Stable id, prefixed with `itunes:` to avoid collisions with other sources. */
  key: string
  title: string
  authors: string[]
  /** iTunes audiobook entries rarely expose narrator as a discrete field. */
  narrator?: string
  year?: string
  /** 1200×1200 cover URL, derived from the API's 100×100 URL. */
  artworkUrl?: string
}

export type ItunesErrorKind = 'network' | 'rate-limit' | 'no-results' | 'unknown'

export class ItunesError extends Error {
  constructor(public kind: ItunesErrorKind, message: string) {
    super(message)
    this.name = 'ItunesError'
  }
}

export type ItunesStage = 1 | 2 | 3

export interface ItunesCascadeOpts {
  title?: string
  author?: string
  narrator?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  onStageStart?: (stage: ItunesStage) => void
}

export interface ItunesCascadeResult {
  results: ItunesResult[]
  stage: ItunesStage
}

interface ApiDoc {
  collectionId?: number
  trackId?: number
  collectionName?: string
  trackName?: string
  artistName?: string
  artworkUrl100?: string
  artworkUrl60?: string
  releaseDate?: string
}

interface ApiResponse {
  resultCount: number
  results: ApiDoc[]
}

function upgradeArtwork(url: string | undefined): string | undefined {
  if (!url) return undefined
  // iTunes serves arbitrary sizes; 1200×1200 is comfortable for our resize step.
  return url.replace(/\/\d+x\d+(bb)?(-\d+)?\.(jpg|png)$/i, '/1200x1200bb.jpg')
}

function yearFromReleaseDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const m = value.match(/^(\d{4})/)
  return m ? m[1] : undefined
}

function docToResult(doc: ApiDoc): ItunesResult | null {
  const title = doc.collectionName || doc.trackName
  if (!title) return null
  const id = doc.collectionId ?? doc.trackId
  if (id == null) return null
  return {
    key: `itunes:${id}`,
    title: title.trim(),
    authors: doc.artistName ? [doc.artistName.trim()] : [],
    year: yearFromReleaseDate(doc.releaseDate),
    artworkUrl: upgradeArtwork(doc.artworkUrl100 || doc.artworkUrl60),
  }
}

interface SingleSearchOpts {
  term: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

async function searchITunesOnce({
  term,
  signal,
  fetchImpl = fetch,
}: SingleSearchOpts): Promise<ItunesResult[]> {
  if (!term.trim()) {
    throw new ItunesError('unknown', 'Empty search term.')
  }
  const url = new URL(BASE_URL)
  url.searchParams.set('term', term.trim())
  url.searchParams.set('media', 'audiobook')
  url.searchParams.set('country', COUNTRY)
  url.searchParams.set('limit', String(RESULT_LIMIT))

  let response: Response
  try {
    response = await fetchImpl(url.toString(), { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ItunesError('network', 'Could not reach iTunes. Check your connection and try again.')
  }

  if (response.status === 429) {
    throw new ItunesError('rate-limit', 'iTunes is rate-limiting requests. Try again in a few minutes.')
  }
  if (!response.ok) {
    throw new ItunesError('unknown', `iTunes returned status ${response.status}.`)
  }

  let data: ApiResponse
  try {
    data = (await response.json()) as ApiResponse
  } catch {
    throw new ItunesError('unknown', 'iTunes returned an unexpected response.')
  }

  const results = (data.results ?? [])
    .map(docToResult)
    .filter((r): r is ItunesResult => r !== null)

  if (results.length === 0) {
    throw new ItunesError('no-results', 'No matches found on iTunes.')
  }
  return results.slice(0, RESULT_LIMIT)
}

/**
 * Multi-stage iTunes search:
 *   1. title + author
 *   2. title + narrator (skipped when narrator empty)
 *   3. title alone
 * Stops at the first stage that returns results. Throws no-results if
 * every applicable stage is empty.
 */
export async function searchItunesCascade(opts: ItunesCascadeOpts): Promise<ItunesCascadeResult> {
  const title = opts.title?.trim() ?? ''
  const author = opts.author?.trim() ?? ''
  const narrator = opts.narrator?.trim() ?? ''

  if (!title && !author && !narrator) {
    throw new ItunesError('unknown', 'Need at least a title, author, or narrator to search.')
  }

  const tryStage = async (stage: ItunesStage, term: string): Promise<ItunesResult[] | null> => {
    if (!term.trim()) return null
    opts.onStageStart?.(stage)
    try {
      return await searchITunesOnce({ term, signal: opts.signal, fetchImpl: opts.fetchImpl })
    } catch (err) {
      if (err instanceof ItunesError && err.kind === 'no-results') return null
      throw err
    }
  }

  // Stage 1: title + author
  if (title || author) {
    const term = [title, author].filter(Boolean).join(' ').trim()
    const r = await tryStage(1, term)
    if (r) return { results: r, stage: 1 }
  }

  // Stage 2: title + narrator (requires both)
  if (title && narrator) {
    const r = await tryStage(2, `${title} ${narrator}`)
    if (r) return { results: r, stage: 2 }
  }

  // Stage 3: title alone
  if (title) {
    const r = await tryStage(3, title)
    if (r) return { results: r, stage: 3 }
  }

  throw new ItunesError('no-results', 'No matches found on iTunes.')
}
