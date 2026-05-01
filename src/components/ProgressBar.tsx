'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { formatEta } from '@/lib/format/eta'

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
  const startMsRef = useRef<number | null>(null)
  const [eta, setEta] = useState<string | null>(null)

  const isActive = ACTIVE_STATUSES.has(progress.status)

  useEffect(() => {
    if (!isActive) {
      startMsRef.current = null
      setEta(null)
      return
    }
    if (startMsRef.current == null) {
      startMsRef.current = performance.now()
    }
    const elapsed = performance.now() - startMsRef.current
    setEta(formatEta(elapsed, progress.percent))
  }, [isActive, progress.percent])

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

  if (!isActive) return null

  return (
    <div
      className="mt-4 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate text-zinc-800 dark:text-zinc-100">{progress.label}</span>
        <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {progress.percent}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-accent-500 transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {eta && (
        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{eta}</p>
      )}
    </div>
  )
}
