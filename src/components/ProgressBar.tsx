'use client'

import { useEffect } from 'react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { useEta } from '@/lib/hooks/useEta'
import { useWakeLock } from '@/lib/hooks/useWakeLock'
import ToolError from '@/components/ToolError'

const ACTIVE_STATUSES = new Set([
  'loading-ffmpeg',
  'probing',
  'encoding',
  'concatenating',
  'muxing',
])

// Encoding occupies global percent range 10–80; the time left is projected
// over that step only, where nearly all the time goes.
const ENC_START = 10
const ENC_SPAN = 80 - ENC_START

export default function ProgressBar() {
  const progress = useConversionStore((s) => s.progress)
  const setProgress = useConversionStore((s) => s.setProgress)

  const isActive = ACTIVE_STATUSES.has(progress.status)

  // Warn before leaving while a conversion is running — closing the tab or
  // navigating away throws away all in-progress work (can be 15+ minutes).
  useEffect(() => {
    if (!isActive) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isActive])

  // Keep the screen awake while converting so the OS doesn't sleep the tab
  // (which can pause the wasm worker and break long-running conversions).
  useWakeLock(isActive)

  const eta = useEta(
    progress.fraction ?? (progress.percent - ENC_START) / ENC_SPAN,
    progress.status === 'encoding',
    progress.remainingMs,
  )

  if (progress.status === 'idle' || progress.status === 'done') return null

  if (progress.status === 'error') {
    return (
      <ToolError title="Conversion failed." message={progress.label} onDismiss={() => setProgress({ status: 'idle', percent: 0, label: '' })} />
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
      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Conversion progress"
        className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className="h-full bg-accent-500 transition-all"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {eta && (
        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">{eta}</p>
      )}
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Converting locally in your browser — no upload needed. Your screen stays awake; just keep this tab open until it finishes.
      </p>
    </div>
  )
}
