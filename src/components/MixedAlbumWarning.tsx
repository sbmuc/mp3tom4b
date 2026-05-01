'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import type { AudioFile } from '@/types'

interface AlbumGroup {
  name: string
  count: number
  ids: string[]
}

interface Disagreement {
  groups: AlbumGroup[]
  majorityAlbum: string | null
  outlierIds: string[]
}

function analyseAlbums(files: AudioFile[]): Disagreement | null {
  const buckets = new Map<string, string[]>()
  for (const f of files) {
    const album = f.embeddedAlbum?.trim()
    if (!album) continue
    const arr = buckets.get(album) ?? []
    arr.push(f.id)
    buckets.set(album, arr)
  }
  if (buckets.size < 2) return null

  const groups: AlbumGroup[] = Array.from(buckets.entries())
    .map(([name, ids]) => ({ name, count: ids.length, ids }))
    .sort((a, b) => b.count - a.count)

  const majorityAlbum =
    groups[0].count > groups[1].count ? groups[0].name : null
  const outlierIds = majorityAlbum
    ? groups.filter((g) => g.name !== majorityAlbum).flatMap((g) => g.ids)
    : []

  return { groups, majorityAlbum, outlierIds }
}

export default function MixedAlbumWarning() {
  const files = useConversionStore((s) => s.files)
  const removeFile = useConversionStore((s) => s.removeFile)

  const result = analyseAlbums(files)
  const albumKey = result ? result.groups.map((g) => g.name).join('|') : ''

  const [dismissedKey, setDismissedKey] = useState<string | null>(null)

  // Re-show the warning if the album set changes after dismissal.
  useEffect(() => {
    if (dismissedKey && dismissedKey !== albumKey) {
      setDismissedKey(null)
    }
  }, [albumKey, dismissedKey])

  if (!result) return null
  if (dismissedKey === albumKey) return null

  const albumList = result.groups.map((g) => g.name).join(', ')
  const canRemoveOutliers = result.outlierIds.length > 0

  const handleRemoveOutliers = () => {
    for (const id of result.outlierIds) removeFile(id)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p>
          These files appear to be from different audiobooks ({albumList}). Continue anyway?
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canRemoveOutliers ? (
            <button
              type="button"
              onClick={handleRemoveOutliers}
              className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
            >
              Remove {result.outlierIds.length} outlier
              {result.outlierIds.length === 1 ? '' : 's'} (keep &ldquo;{result.majorityAlbum}&rdquo;)
            </button>
          ) : (
            <span className="text-xs text-amber-800 dark:text-amber-300">
              Multiple albums tied — remove the unwanted files manually.
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissedKey(albumKey)}
        aria-label="Dismiss mixed-album warning"
        className="rounded p-0.5 text-amber-700 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
