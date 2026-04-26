'use client'

import { Info, X } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'

export default function DuplicateNotice() {
  const notice = useConversionStore((s) => s.duplicateNotice)
  const dismiss = useConversionStore((s) => s.setDuplicateNotice)

  if (!notice) return null
  const { fileNames } = notice
  if (fileNames.length === 0) return null

  const message =
    fileNames.length === 1
      ? `${fileNames[0]} is already in your list.`
      : `Skipped ${fileNames.length} duplicate files: ${fileNames.join(', ')} (already in list).`

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 break-words">{message}</p>
      <button
        type="button"
        onClick={() => dismiss(null)}
        aria-label="Dismiss duplicate notice"
        className="rounded p-0.5 text-amber-700 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
