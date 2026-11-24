'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { DISC_PROBLEM, discTag } from '@/lib/audio/disc'

export interface SeriesAndDescription {
  description: string
  series: string
  seriesPart: string
  disc: string
}

interface Props {
  /** Prefix for the fields' ids, unique on the page. */
  idPrefix: string
  value: SeriesAndDescription
  onChange: (patch: Partial<SeriesAndDescription>) => void
  /** Something to show after a label, like a "from iTunes" badge. */
  badges?: Partial<Record<keyof SeriesAndDescription, ReactNode>>
  inputClass: string
  labelClass: string
}

/**
 * The series, its number, the disc number and the description, in a book's
 * details. Folded away behind one button while all are empty (most books need
 * none of them); open as soon as one has a value, from the file's tags or a
 * lookup.
 */
export default function SeriesDescriptionFields({ idPrefix, value, onChange, badges, inputClass, labelClass }: Props) {
  const [opened, setOpened] = useState(false)
  const seriesRef = useRef<HTMLInputElement>(null)
  const hasValue =
    value.description.trim() !== '' || value.series.trim() !== '' || value.seriesPart.trim() !== '' || value.disc.trim() !== ''
  const discProblem = value.disc.trim() !== '' && discTag(value.disc) === null

  // Opened with the button: on to the first field.
  useEffect(() => {
    if (opened) seriesRef.current?.focus()
  }, [opened])

  if (!opened && !hasValue) {
    return (
      <button
        type="button"
        onClick={() => setOpened(true)}
        aria-expanded={false}
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-accent-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400"
      >
        <Plus size={14} aria-hidden="true" />
        Series, disc number and description
        <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
      </button>
    )
  }

  const optional = <span className="text-zinc-500 dark:text-zinc-400">(optional)</span>
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_9rem_9rem]">
      <div>
        <label htmlFor={`${idPrefix}-series`} className={labelClass}>
          Series {optional}
          {badges?.series}
        </label>
        <input
          ref={seriesRef}
          id={`${idPrefix}-series`}
          type="text"
          value={value.series}
          onChange={(e) => onChange({ series: e.target.value })}
          placeholder="e.g. The Lord of the Rings"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-series-part`} className={labelClass}>
          Number in series
          {badges?.seriesPart}
        </label>
        <input
          id={`${idPrefix}-series-part`}
          type="text"
          inputMode="decimal"
          maxLength={10}
          value={value.seriesPart}
          onChange={(e) => onChange({ seriesPart: e.target.value })}
          placeholder="e.g. 1"
          className={`${inputClass} font-mono`}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-disc`} className={labelClass}>
          Disc number
          {badges?.disc}
        </label>
        <input
          id={`${idPrefix}-disc`}
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={value.disc}
          // Digits and one slash: 2, or 2/3 for disc 2 of 3.
          onChange={(e) => onChange({ disc: e.target.value.replace(/[^\d/]/g, '').replace(/(\/.*)\//g, '$1') })}
          placeholder="e.g. 2 or 1/2"
          aria-invalid={discProblem || undefined}
          aria-describedby={discProblem ? `${idPrefix}-disc-err` : undefined}
          className={`${inputClass} font-mono`}
        />
        {discProblem && (
          <p id={`${idPrefix}-disc-err`} className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            {DISC_PROBLEM}
          </p>
        )}
      </div>
      <div className="sm:col-span-3">
        <label htmlFor={`${idPrefix}-description`} className={labelClass}>
          Description {optional}
          {badges?.description}
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={4}
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What the book is about"
          aria-describedby={`${idPrefix}-extras-help`}
          className={`${inputClass} resize-y`}
        />
        <p id={`${idPrefix}-extras-help`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Saved in the M4B&apos;s tags. Audiobookshelf reads the series and the description, Mp3tag shows the disc
          number as Discnumber (a book in two parts can be 1/2 and 2/2); apps that don&apos;t use them simply ignore
          them.
        </p>
      </div>
    </div>
  )
}
