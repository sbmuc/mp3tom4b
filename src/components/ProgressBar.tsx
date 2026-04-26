'use client'

import { AlertCircle } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'

const ACTIVE_STATUSES = new Set([
  'loading-ffmpeg',
  'probing',
  'encoding',
  'concatenating',
  'muxing',
])

export default function ProgressBar() {
  const progress = useConversionStore((s) => s.progress)
  const setProgress = useConversionStore((s) => s.setProgress)

  if (progress.status === 'idle' || progress.status === 'done') return null

  if (progress.status === 'error') {
    return (
      <div
        role="alert"
        className="mt-4 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium">Conversion failed.</p>
          <p className="mt-0.5 break-words">{progress.label || 'An unknown error occurred.'}</p>
        </div>
        <button
          type="button"
          onClick={() => setProgress({ status: 'idle', percent: 0, label: '' })}
          className="rounded px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40"
        >
          Dismiss
        </button>
      </div>
    )
  }

  if (!ACTIVE_STATUSES.has(progress.status)) return null

  return (
    <div
      className="mt-4 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-zinc-800 dark:text-zinc-100">{progress.label}</span>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {progress.percent}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-accent-500 transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}
