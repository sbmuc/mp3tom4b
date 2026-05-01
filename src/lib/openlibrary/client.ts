/**
 * Tiny client for the Open Library Search API.
 * https://openlibrary.org/dev/docs/api/search
 *
 * Privacy: only the title and author strings the user typed are sent.
 * No audio data, no cover images, no user identifiers. The request runs
 * straight from the browser to openlibrary.org — we don't proxy it.
 */

const BASE_URL = 'https://openlibrary.org/search.json'
const RESULT_LIMIT = 5

export interface OpenLibraryResult {
  /** Open Library work key, e.g. `/works/OL45804W` */
  key: string
  title: string
  authors: string[]
  year?: string
}

export type OpenLibraryErrorKind = 'network' | 'rate-limit' | 'no-results' | 'unknown'

export class OpenLibraryError extends Error {
  constructor(public kind: OpenLibraryErrorKind, message: string) {
    super(message)
    this.name = 'OpenLibraryError'
  }
}

interface ApiDoc {
  key: string
  title?: string
  author_name?: string[]
  first_publish_year?: number
}

interface ApiResponse {
  docs: ApiDoc[]
  numFound?: number
}

export type SearchStage = 1 | 2 | 3

export interface CascadeOptions {
  title?: string
  author?: string
  /** Narrator field — used only as a fallback "author" in Stage 2. */
  narrator?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /**
   * Fired immediately before each network request, so the UI can show
   * a "Searching… → Trying alternative search… → Broadening search…"
   * progression without exposing the per-stage retry mechanics.
   */
  onStageStart?: (stage: SearchStage) => void
}

export interface CascadeResult {
  results: OpenLibraryResult[]
  /** Which stage produced the returned results. */
  stage: SearchStage
}

/**
 * Multi-stage Open Library search. Stages run sequentially and stop at the
 * first stage that returns matches.
 *   1. title + author (the originally typed pair)
 *   2. title + narrator (only if narrator is non-empty)
 *   3. title alone
 * If every applicable stage returns no-results, throws OpenLibraryError(no-results).
 */
export async function searchBooksCascade(opts: CascadeOptions): Promise<CascadeResult> {
  const title = opts.title?.trim() ?? ''
  const author = opts.author?.trim() ?? ''
  const narrator = opts.narrator?.trim() ?? ''

  if (!title && !author && !narrator) {
    throw new OpenLibraryError('unknown', 'Need at least a title, author, or narrator to search.')
  }

  const tryStage = async (stage: SearchStage, search: SearchOptions): Promise<OpenLibraryResult[] | null> => {
    opts.onStageStart?.(stage)
    try {
      return await searchBooks({ ...search, signal: opts.signal, fetchImpl: opts.fetchImpl })
    } catch (err) {
      if (err instanceof OpenLibraryError && err.kind === 'no-results') return null
      throw err
    }
  }

  // Stage 1 — runs whenever we have title or author.
  if (title || author) {
    const results = await tryStage(1, { title, author })
    if (results) return { results, stage: 1 }
  }

  // Stage 2 — title + narrator. Skipped when narrator empty or title empty.
  if (title && narrator) {
    const results = await tryStage(2, { title, author: narrator })
    if (results) return { results, stage: 2 }
  }

  // Stage 3 — title alone. Skipped if no title (Stage 1 was the only chance).
  if (title) {
    const results = await tryStage(3, { title })
    if (results) return { results, stage: 3 }
  }

  throw new OpenLibraryError(
    'no-results',
    'No matches found on Open Library. You can fill the fields manually below.'
  )
}

export interface SearchOptions {
  title?: string
  author?: string
  signal?: AbortSignal
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch
}

export async function searchBooks({
  title,
  author,
  signal,
  fetchImpl = fetch,
}: SearchOptions): Promise<OpenLibraryResult[]> {
  if (!title?.trim() && !author?.trim()) {
    throw new OpenLibraryError('unknown', 'Need at least a title or an author to search.')
  }

  const url = new URL(BASE_URL)
  url.searchParams.set('limit', String(RESULT_LIMIT))
  url.searchParams.set('fields', 'title,author_name,first_publish_year,key')
  if (title?.trim()) url.searchParams.set('title', title.trim())
  if (author?.trim()) url.searchParams.set('author', author.trim())

  let response: Response
  try {
    response = await fetchImpl(url.toString(), { signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new OpenLibraryError('network', 'Could not reach Open Library. Check your connection and try again.')
  }

  if (response.status === 429) {
    throw new OpenLibraryError('rate-limit', 'Open Library is rate-limiting requests. Try again in a few minutes.')
  }
  if (!response.ok) {
    throw new OpenLibraryError('unknown', `Open Library returned status ${response.status}.`)
  }

  let data: ApiResponse
  try {
    data = (await response.json()) as ApiResponse
  } catch {
    throw new OpenLibraryError('unknown', 'Open Library returned an unexpected response.')
  }

  const docs = Array.isArray(data.docs) ? data.docs : []
  if (docs.length === 0) {
    throw new OpenLibraryError('no-results', 'No matches found. Try a different title or author.')
  }

  return docs.slice(0, RESULT_LIMIT).map((doc) => ({
    key: doc.key,
    title: doc.title?.trim() || 'Untitled',
    authors: (doc.author_name ?? []).map((a) => a.trim()).filter(Boolean),
    year: doc.first_publish_year != null ? String(doc.first_publish_year) : undefined,
  }))
}
