'use client'

import { useRouter } from 'next/navigation'
import { ListOrdered } from 'lucide-react'
import { handOffToChapterizer, singleLongFile } from '@/lib/handoff'
import { useConversionStore } from '@/lib/store/conversionStore'
import type { ConversionMetadata } from '@/types'

/** "16 min", "11 h 32 min": a length, not a clock time like 16:00. */
function lengthLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`
}

/**
 * The converter makes one chapter per file, so one long file comes out as a
 * single chapter (GitHub issue #1). When that's what's in the list, offer
 * "Add chapters", taking along the file, what the user typed, and a dropped
 * cover, so nothing has to be dropped or filled in twice. A cue sheet dropped
 * with the file goes along too, and its tracks become the chapters.
 */
export default function SingleFileChaptersHint() {
  const files = useConversionStore((s) => s.files)
  const metadata = useConversionStore((s) => s.metadata)
  const userTouched = useConversionStore((s) => s.userTouched)
  const verifiedFields = useConversionStore((s) => s.verifiedFields)
  const coverFile = useConversionStore((s) => s.coverFile)
  const coverSource = useConversionStore((s) => s.coverSource)
  const cue = useConversionStore((s) => s.cue)
  const router = useRouter()

  // One file with a cue sheet (any length), or one long file.
  const withCue = files.length === 1 && cue ? files[0] : null
  const long = withCue ?? singleLongFile(files)
  if (!long) return null
  const cueChapters = withCue && cue ? cue.sheet.chapters.length : 0

  const openChapterizer = () => {
    const keep: Partial<ConversionMetadata> = {}
    for (const field of Object.keys(metadata) as (keyof ConversionMetadata)[]) {
      if (userTouched[field] || verifiedFields[field]) keep[field] = metadata[field] as never
    }
    handOffToChapterizer({
      file: long.file,
      // A cover from the audio itself is read again on the other side.
      cover: coverSource === 'drop' || coverSource === 'user' ? coverFile : null,
      cue: withCue && cue ? cue.file : null,
      metadata: keep,
    })
    router.push('/add-chapters-to-mp3')
  }

  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-2 rounded-md border border-accent-200 bg-accent-50 p-3 text-sm text-zinc-800 dark:border-accent-900 dark:bg-accent-950/40 dark:text-zinc-200"
    >
      <ListOrdered size={16} className="mt-0.5 shrink-0 text-accent-700 dark:text-accent-400" aria-hidden="true" />
      <div className="flex-1">
        {cueChapters > 0 ? (
          <p>
            <span className="font-medium">
              This file has a cue sheet with {cueChapters} chapter{cueChapters === 1 ? '' : 's'}.
            </span>{' '}
            Here one file becomes one chapter; Add chapters makes the M4B with the cue sheet&apos;s chapters, and
            takes this file and what you&apos;ve filled in along.
          </p>
        ) : (
          <p>
            <span className="font-medium">One file becomes one chapter.</span> To split this file (
            {lengthLabel(long.duration ?? 0)}) into chapters, at the pauses in the narration or every few minutes,
            use Add chapters. It takes this file and what you&apos;ve filled in along.
          </p>
        )}
        <button
          type="button"
          onClick={openChapterizer}
          className="mt-2 rounded-md border border-accent-300 bg-white px-2.5 py-1 text-xs font-medium text-accent-800 hover:bg-accent-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-accent-700 dark:bg-accent-950/60 dark:text-accent-200 dark:hover:bg-accent-900/60"
        >
          Add chapters to this file
        </button>
      </div>
    </div>
  )
}
