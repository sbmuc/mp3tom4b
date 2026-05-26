'use client'

import { useRef } from 'react'
import { Loader2, Wand2, X } from 'lucide-react'
import { track } from '@vercel/analytics'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import { useConversionStore } from '@/lib/store/conversionStore'

const ACTIVE_STATUSES = new Set(['loading-ffmpeg', 'probing', 'encoding', 'concatenating', 'muxing'])

export default function ConvertButton() {
  const files = useConversionStore((s) => s.files)
  const metadata = useConversionStore((s) => s.metadata)
  const coverFile = useConversionStore((s) => s.coverFile)
  const bitrate = useConversionStore((s) => s.bitrate)
  const progress = useConversionStore((s) => s.progress)
  const setProgress = useConversionStore((s) => s.setProgress)
  const setOutputBlob = useConversionStore((s) => s.setOutputBlob)
  const cancelConversion = useConversionStore((s) => s.cancelConversion)
  const setSubmitAttempted = useConversionStore((s) => s.setSubmitAttempted)

  // Tracks whether the current conversion was explicitly cancelled so we can
  // suppress the error state that bubbles up after workers are terminated.
  const cancelledRef = useRef(false)

  const titleOk = metadata.title.trim().length > 0
  const authorOk = metadata.author.trim().length > 0
  const filesOk = files.length > 0
  const isRunning = ACTIVE_STATUSES.has(progress.status)
  const invalid = !filesOk || !titleOk || !authorOk

  const missing: string[] = []
  if (!filesOk) missing.push('add at least one audio file')
  if (!titleOk) missing.push('enter a title')
  if (!authorOk) missing.push('enter an author')

  const handleClick = async () => {
    if (isRunning) return
    if (invalid) {
      // Reveal hidden form errors and move focus to the first missing field
      // so screen-reader users get an immediate, clear signal.
      setSubmitAttempted(true)
      if (!filesOk) {
        document.getElementById('dropzone')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (!titleOk) {
        document.getElementById('md-title')?.focus()
      } else if (!authorOk) {
        document.getElementById('md-author')?.focus()
      }
      return
    }

    cancelledRef.current = false
    setOutputBlob(null)
    const startedAt = Date.now()
    try {
      const blob = await convertToM4B({
        files,
        metadata,
        coverFile,
        bitrate,
        onProgress: (p) => {
          // Drop progress events that arrive after a cancel — the store already
          // reset to idle and we don't want an error flash from the dying workers.
          if (!cancelledRef.current) setProgress(p)
        },
      })
      setOutputBlob(blob)

      // Funnel telemetry: how often does a landed visitor finish a conversion?
      // Anonymous, cookieless via Vercel Web Analytics. No file content, only
      // aggregate shape metrics.
      const totalAudioSec = files.reduce((acc, f) => acc + (f.duration ?? 0), 0)
      track('conversion_completed', {
        fileCount: files.length,
        bitrateKbps: bitrate,
        genre: metadata.genre,
        audioDurationSec: Math.round(totalAudioSec),
        outputMb: Math.round((blob.size / (1024 * 1024)) * 10) / 10,
        elapsedSec: Math.round((Date.now() - startedAt) / 1000),
        hasCover: coverFile != null,
      })
    } catch {
      // Errors are surfaced via the onProgress 'error' event above.
      // User input is preserved for retry.
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    cancelConversion()
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          // Intentionally not `disabled`: keep the button clickable so a click
          // on an "almost-ready" form reveals errors and focuses the missing
          // field instead of silently doing nothing. Visually dimmed when not
          // ready, but still announced as a button to assistive tech.
          aria-disabled={invalid || isRunning || undefined}
          aria-describedby={invalid && !isRunning ? 'convert-help' : undefined}
          className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
            invalid || isRunning
              ? 'bg-accent-600/50 hover:bg-accent-600/60 dark:bg-accent-700/50 cursor-not-allowed'
              : 'bg-accent-600 hover:bg-accent-700'
          }`}
        >
          {isRunning ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 size={16} aria-hidden="true" />
          )}
          {isRunning ? 'Converting…' : 'Convert to M4B'}
        </button>
        {isRunning && (
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <X size={14} aria-hidden="true" />
            Cancel
          </button>
        )}
      </div>
      {invalid && !isRunning && missing.length > 0 && (
        <p id="convert-help" className="text-xs text-zinc-500 dark:text-zinc-400">
          To enable: {missing.join(', ')}.
        </p>
      )}
    </div>
  )
}
