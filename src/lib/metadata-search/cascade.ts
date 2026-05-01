/**
 * Unified online-metadata search across iTunes (audiobook media) and
 * Open Library (books). iTunes is tried first because it has audiobook-
 * specific data; Open Library is the fallback. Each source has its own
 * three-stage cascade (title+author, title+narrator, title-only).
 *
 * Stages are reported through onStageStart as `<source>-<stage>` ids so
 * the UI can paint a "Searching iTunes… → Trying alternative search… →
 * Searching Open Library…" progression without revealing the retries.
 */

import {
  ItunesError,
  searchItunesCascade,
  type ItunesResult,
  type ItunesStage,
} from '../itunes/client'
import {
  OpenLibraryError,
  searchBooksCascade,
  type OpenLibraryResult,
  type SearchStage as OLStage,
} from '../openlibrary/client'
import type { MetadataSource } from '@/types'

export type CascadeStageId =
  | 'itunes-1'
  | 'itunes-2'
  | 'itunes-3'
  | 'openlibrary-1'
  | 'openlibrary-2'
  | 'openlibrary-3'

export interface UnifiedResult {
  source: MetadataSource
  /** Source-prefixed unique key, e.g. `itunes:123` or `/works/OLx`. */
  key: string
  title: string
  authors: string[]
  narrator?: string
  year?: string
  /** Cover URL — currently only provided by iTunes results. */
  artworkUrl?: string
}

export interface UnifiedCascadeResult {
  results: UnifiedResult[]
  stage: CascadeStageId
}

export interface UnifiedCascadeOpts {
  title?: string
  author?: string
  narrator?: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  onStageStart?: (stage: CascadeStageId) => void
}

export class MetadataSearchError extends Error {
  constructor(public kind: 'no-results' | 'unknown', message: string) {
    super(message)
    this.name = 'MetadataSearchError'
  }
}

function itunesToUnified(r: ItunesResult): UnifiedResult {
  return {
    source: 'itunes',
    key: r.key,
    title: r.title,
    authors: r.authors,
    narrator: r.narrator,
    year: r.year,
    artworkUrl: r.artworkUrl,
  }
}

function openLibraryToUnified(r: OpenLibraryResult): UnifiedResult {
  return {
    source: 'openlibrary',
    key: r.key,
    title: r.title,
    authors: r.authors,
    year: r.year,
  }
}

export async function searchAllSources(opts: UnifiedCascadeOpts): Promise<UnifiedCascadeResult> {
  const title = opts.title?.trim() ?? ''
  const author = opts.author?.trim() ?? ''
  const narrator = opts.narrator?.trim() ?? ''

  if (!title && !author && !narrator) {
    throw new MetadataSearchError('unknown', 'Need at least a title, author, or narrator to search.')
  }

  // 1) iTunes cascade. Treat its no-results as "fall through to Open Library".
  try {
    const it = await searchItunesCascade({
      title,
      author,
      narrator,
      signal: opts.signal,
      fetchImpl: opts.fetchImpl,
      onStageStart: (s: ItunesStage) => opts.onStageStart?.(`itunes-${s}` as CascadeStageId),
    })
    return {
      results: it.results.map(itunesToUnified),
      stage: `itunes-${it.stage}` as CascadeStageId,
    }
  } catch (err) {
    if (!(err instanceof ItunesError && err.kind === 'no-results')) throw err
  }

  // 2) Open Library cascade — left exactly as it was, just chained.
  try {
    const ol = await searchBooksCascade({
      title,
      author,
      narrator,
      signal: opts.signal,
      fetchImpl: opts.fetchImpl,
      onStageStart: (s: OLStage) => opts.onStageStart?.(`openlibrary-${s}` as CascadeStageId),
    })
    return {
      results: ol.results.map(openLibraryToUnified),
      stage: `openlibrary-${ol.stage}` as CascadeStageId,
    }
  } catch (err) {
    if (err instanceof OpenLibraryError && err.kind === 'no-results') {
      throw new MetadataSearchError(
        'no-results',
        'No matches on iTunes or Open Library. You can fill the fields manually below.'
      )
    }
    throw err
  }
}
