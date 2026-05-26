'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  MetadataSearchError,
  searchAllSources,
  type CascadeStageId,
  type UnifiedResult,
} from '@/lib/metadata-search/cascade'
import { useConversionStore } from '@/lib/store/conversionStore'
import type { ConversionMetadata } from '@/types'

type Phase = 'idle' | 'confirming' | 'searching' | 'results' | 'error'

const SOURCE_LABEL = {
  itunes: 'via iTunes',
  openlibrary: 'via Open Library',
} as const

function stageStatus(stage: CascadeStageId, hasNarrator: boolean, title: string): string {
  switch (stage) {
    case 'itunes-1':
      return 'Searching iTunes…'
    case 'itunes-2':
      return 'No matches with author. Trying narrator on iTunes…'
    case 'itunes-3': {
      const quoted = title ? `“${title}”` : 'this title'
      const prefix = hasNarrator ? 'Still no matches.' : 'No matches.'
      return `${prefix} Broadening iTunes search to all books titled ${quoted}…`
    }
    case 'openlibrary-1':
      return 'No iTunes matches. Searching Open Library…'
    case 'openlibrary-2':
      return 'Trying narrator on Open Library…'
    case 'openlibrary-3': {
      const quoted = title ? `“${title}”` : 'this title'
      return `Broadening Open Library search to all books titled ${quoted}…`
    }
  }
}

function stageResultsHint(stage: CascadeStageId, title: string): string | null {
  if (stage === 'itunes-1' || stage === 'openlibrary-1') return null
  if (stage === 'itunes-2' || stage === 'openlibrary-2') {
    return 'Found via narrator search. Pick the right edition.'
  }
  return `Showing all books titled “${title}”. Pick the right edition.`
}

/**
 * Was this result returned by a Stage 2 (narrator) search? If so, picking
 * a result whose author matches the user's narrator field implies the
 * user typed Author/Narrator into swapped slots.
 */
function isStage2(stage: CascadeStageId): boolean {
  return stage === 'itunes-2' || stage === 'openlibrary-2'
}

async function fetchCoverAsFile(url: string): Promise<File> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cover fetch failed: ${res.status}`)
  const blob = await res.blob()
  const ext = blob.type.includes('png') ? 'png' : 'jpg'
  return new File([blob], `itunes-cover.${ext}`, { type: blob.type || 'image/jpeg' })
}

export default function MetadataLookup() {
  const metadata = useConversionStore((s) => s.metadata)
  const applyVerifiedMetadata = useConversionStore((s) => s.applyVerifiedMetadata)
  const setMetadata = useConversionStore((s) => s.setMetadata)
  const setCoverFile = useConversionStore((s) => s.setCoverFile)

  const [phase, setPhase] = useState<Phase>('idle')
  const [stageInFlight, setStageInFlight] = useState<CascadeStageId>('itunes-1')
  const [resultStage, setResultStage] = useState<CascadeStageId | null>(null)
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [toast, setToast] = useState<string | null>(null)
  const [coverPrompt, setCoverPrompt] = useState<{ url: string } | null>(null)

  const title = metadata.title.trim()
  const author = metadata.author.trim()
  const narrator = metadata.narrator.trim()
  const canSearch = title.length > 0 || author.length > 0 || narrator.length > 0

  const queryDescription = title && author
    ? `“${title}” by ${author}`
    : title
      ? `“${title}”`
      : `author “${author}”`

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  const close = () => {
    setPhase('idle')
    setResults([])
    setErrorMessage('')
    setResultStage(null)
    setCoverPrompt(null)
  }

  const runSearch = async () => {
    setPhase('searching')
    setStageInFlight('itunes-1')
    setErrorMessage('')
    try {
      const { results: docs, stage } = await searchAllSources({
        title,
        author,
        narrator,
        onStageStart: setStageInFlight,
      })
      setResults(docs)
      setResultStage(stage)
      setPhase('results')
    } catch (err) {
      if (err instanceof MetadataSearchError) {
        setErrorMessage(err.message)
      } else if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Something went wrong contacting the metadata sources.')
      }
      setPhase('error')
    }
  }

  const pickResult = (r: UnifiedResult) => {
    const pickedAuthor = r.authors[0]?.trim() ?? ''
    const olPatch: Partial<ConversionMetadata> = { title: r.title }
    if (r.year) olPatch.year = r.year
    if (r.narrator) olPatch.narrator = r.narrator

    const isSwap =
      resultStage !== null &&
      isStage2(resultStage) &&
      narrator !== '' &&
      pickedAuthor.toLowerCase() === narrator.toLowerCase()

    olPatch.author = isSwap ? narrator : pickedAuthor || metadata.author
    applyVerifiedMetadata(olPatch, r.source)

    if (isSwap) {
      // Narrator becomes the user's previously-typed author. setMetadata
      // marks it as user-touched (no source badge), which is correct —
      // that string was never on the external source.
      setMetadata({ narrator: metadata.author })
      setToast('Swapped Author and Narrator based on Open Library match.')
    }

    // Surface the cover prompt instead of immediately closing the panel.
    if (r.source === 'itunes' && r.artworkUrl) {
      setCoverPrompt({ url: r.artworkUrl })
    } else {
      close()
    }
  }

  const applyCover = async () => {
    if (!coverPrompt) return
    try {
      const file = await fetchCoverAsFile(coverPrompt.url)
      setCoverFile(file)
    } catch {
      setToast('Could not download the cover image. You can upload one manually.')
    }
    close()
  }

  const skipCover = () => {
    close()
  }

  const hasNarrator = narrator !== ''
  const resultsHint = resultStage ? stageResultsHint(resultStage, title) : null

  return (
    <section aria-label="Online metadata lookup" className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Verify metadata{' '}
        <span className="text-sm font-normal text-zinc-400">(optional)</span>
      </h2>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-2.5 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="flex-1">{toast}</p>
        </div>
      )}

      {phase === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPhase('confirming')}
            disabled={!canSearch}
            title={!canSearch ? 'Enter a title, author, or narrator first.' : undefined}
            aria-describedby={!canSearch ? 'lookup-help' : undefined}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Search size={14} aria-hidden="true" />
            Look up online
          </button>
          {!canSearch && (
            <p id="lookup-help" className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter a title, author, or narrator first.
            </p>
          )}
        </div>
      )}

      {phase !== 'idle' && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 text-xs text-accent-700 dark:text-accent-300">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Only the title, author, and narrator you typed are sent to{' '}
                <a
                  href="https://itunes.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  itunes.apple.com <ExternalLink size={10} aria-hidden="true" />
                </a>{' '}
                and{' '}
                <a
                  href="https://openlibrary.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  openlibrary.org <ExternalLink size={10} aria-hidden="true" />
                </a>
                . Audio files, cover images, and any other metadata stay in your browser.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close lookup panel"
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {phase === 'confirming' && (
            <div className="mt-3">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Search for {queryDescription}?
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={runSearch}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <Search size={14} aria-hidden="true" />
                  Search
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {phase === 'searching' && (
            <div
              className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
              aria-live="polite"
            >
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              <span>{stageStatus(stageInFlight, hasNarrator, title)}</span>
            </div>
          )}

          {phase === 'error' && (
            <div className="mt-3">
              <p className="text-sm text-rose-700 dark:text-rose-300">{errorMessage}</p>
              <button
                type="button"
                onClick={runSearch}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          )}

          {phase === 'results' && !coverPrompt && (
            <>
              {resultsHint && (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{resultsHint}</p>
              )}
              <ul className="mt-3 space-y-2">
                {results.map((r) => (
                  <li
                    key={r.key}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                  >
                    {r.artworkUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.artworkUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                        loading="lazy"
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {r.title}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {r.authors.join(', ') || 'Unknown author'}
                        {r.narrator ? ` · narrated by ${r.narrator}` : ''}
                        {r.year ? ` · ${r.year}` : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {SOURCE_LABEL[r.source]}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => pickResult(r)}
                      className="shrink-0 rounded-md bg-accent-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                    >
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {phase === 'results' && coverPrompt && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-accent-300 bg-accent-50 p-3 dark:border-accent-800 dark:bg-accent-950/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverPrompt.url}
                alt="Cover preview"
                className="h-14 w-14 shrink-0 rounded object-cover"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none'
                }}
              />
              <div className="min-w-0 flex-1 text-sm text-zinc-800 dark:text-zinc-100">
                <p className="font-medium">Also use this cover image?</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Fetched from iTunes; no audio data is sent.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyCover}
                  className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
                >
                  <ImagePlus size={12} aria-hidden="true" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={skipCover}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
