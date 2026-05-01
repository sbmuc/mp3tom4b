'use client'

import { useConversionStore } from '@/lib/store/conversionStore'
import type { Genre, MetadataSource } from '@/types'

const GENRES: Genre[] = ['Audiobook', 'Podcast', 'Lecture', 'Other']
const CURRENT_YEAR = new Date().getFullYear()

function isValidYear(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}$/.test(value)) return false
  const n = Number(value)
  return n >= 1900 && n <= 2099
}

const SOURCE_LABEL: Record<MetadataSource, string> = {
  itunes: 'from iTunes',
  openlibrary: 'from Open Library',
}

function VerifiedBadge({ source }: { source: MetadataSource }) {
  return (
    <span className="ml-2 inline-flex items-center rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
      {SOURCE_LABEL[source]}
    </span>
  )
}

export default function MetadataForm() {
  const metadata = useConversionStore((s) => s.metadata)
  const setMetadata = useConversionStore((s) => s.setMetadata)
  const verifiedFields = useConversionStore((s) => s.verifiedFields)

  const titleMissing = metadata.title.trim() === ''
  const authorMissing = metadata.author.trim() === ''
  const yearInvalid = !isValidYear(metadata.year)

  const inputBase =
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500'
  const inputOk = 'border-zinc-300 dark:border-zinc-700'
  const inputErr = 'border-rose-400 dark:border-rose-700'
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
  const errClass = 'mt-1 text-xs text-rose-600 dark:text-rose-400'

  return (
    <section aria-label="Audiobook metadata" className="mt-6">
      <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Audiobook details
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="md-title" className={labelClass}>
            Title <span className="text-rose-500">*</span>
            {verifiedFields.title && <VerifiedBadge source={verifiedFields.title} />}
          </label>
          <input
            id="md-title"
            type="text"
            value={metadata.title}
            onChange={(e) => setMetadata({ title: e.target.value })}
            placeholder="The Hobbit"
            aria-invalid={titleMissing}
            className={`${inputBase} ${titleMissing ? inputErr : inputOk}`}
          />
          {titleMissing && <p className={errClass}>Title is required.</p>}
        </div>

        <div>
          <label htmlFor="md-author" className={labelClass}>
            Author <span className="text-rose-500">*</span>
            {verifiedFields.author && <VerifiedBadge source={verifiedFields.author} />}
          </label>
          <input
            id="md-author"
            type="text"
            value={metadata.author}
            onChange={(e) => setMetadata({ author: e.target.value })}
            placeholder="J.R.R. Tolkien"
            aria-invalid={authorMissing}
            className={`${inputBase} ${authorMissing ? inputErr : inputOk}`}
          />
          {authorMissing && <p className={errClass}>Author is required.</p>}
        </div>

        <div>
          <label htmlFor="md-narrator" className={labelClass}>
            Narrator <span className="text-zinc-400">(optional)</span>
            {verifiedFields.narrator && <VerifiedBadge source={verifiedFields.narrator} />}
          </label>
          <input
            id="md-narrator"
            type="text"
            value={metadata.narrator}
            onChange={(e) => setMetadata({ narrator: e.target.value })}
            placeholder="Andy Serkis"
            className={`${inputBase} ${inputOk}`}
          />
        </div>

        <div>
          <label htmlFor="md-year" className={labelClass}>
            Year <span className="text-zinc-400">(optional)</span>
            {verifiedFields.year && <VerifiedBadge source={verifiedFields.year} />}
          </label>
          <input
            id="md-year"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={metadata.year}
            onChange={(e) => setMetadata({ year: e.target.value })}
            placeholder={String(CURRENT_YEAR)}
            aria-invalid={yearInvalid}
            className={`${inputBase} ${yearInvalid ? inputErr : inputOk} font-mono`}
          />
          {yearInvalid && <p className={errClass}>Enter a 4-digit year between 1900 and 2099.</p>}
        </div>

        <div>
          <label htmlFor="md-genre" className={labelClass}>
            Genre
          </label>
          <select
            id="md-genre"
            value={metadata.genre}
            onChange={(e) => setMetadata({ genre: e.target.value as Genre })}
            className={`${inputBase} ${inputOk}`}
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
