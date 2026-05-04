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

// Encoding occupies global percent range 10–80. Map to 0–100 for ETA math.
const ENC_START = 10
const ENC_END = 80
const ENC_SPAN = ENC_END - ENC_START

// Rolling window: keep the last N (timestamp, encodingPct) samples for rate smoothing.
const WINDOW = 6

export default function ProgressBar() {
  const progress = useConversionStore((s) => s.progress)
  const setProgress = useConversionStore((s) => s.setProgress)

  // Timestamp when the encoding phase began (not the overall job start).
  const encodingStartRef = useRef<number | null>(null)
  // Rolling samples: [nowMs, encodingPct] pairs for rate smoothing.
  const samplesRef = useRef<Array<[number, number]>>([])

  const [eta, setEta] = useState<string | null>(null)

  const isActive = ACTIVE_STATUSES.has(progress.status)

  useEffect(() => {
    if (!isActive) {
      encodingStartRef.current = null
      samplesRef.current = []
      setEta(null)
      return
    }

    if (progress.status !== 'encoding') {
      // Outside the encoding window — no meaningful ETA to show.
      setEta(null)
      return
    }

    const now = performance.now()

    // Record when encoding first starts.
    if (encodingStartRef.current == null) {
      encodingStartRef.current = now
      samplesRef.current = []
    }

    // Map global percent → encoding-local percent (0–100).
    const encPct = Math.max(0, Math.min(100, ((progress.percent - ENC_START) / ENC_SPAN) * 100))

    // Accumulate rolling window samples.
    const samples = samplesRef.current
    samples.push([now, encPct])
    if (samples.length > WINDOW) samples.shift()

    // Need at least 2 samples and some elapsed time before projecting.
    const encodingElapsed = now - encodingStartRef.current
    if (samples.length < 2 || encodingElapsed < 8000) {
      setEta(null)
      return
    }

    // Use the oldest sample in the window for a smoothed rate.
    const [oldestMs, oldestPct] = samples[0]
    const windowElapsed = now - oldestMs
    const windowProgress = encPct - oldestPct

    if (windowElapsed <= 0 || windowProgress <= 0) {
      setEta(null)
      return
    }

    // Project: if current pace holds, how long to reach 100%?
    // formatEta expects (elapsed, percent) — synthesise an equivalent linear
    // pair so it computes the same remaining time as (100 - encPct) * msPerPct.
    const msPerPct = windowElapsed / windowProgress
    const syntheticElapsed = encPct * msPerPct
    setEta(formatEta(syntheticElapsed, encPct))
  }, [isActive, progress.percent, progress.status])

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
      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Converting locally in your browser — no upload needed. Keep this tab open and your device awake until it finishes.
      </p>
    </div>
  )
}
