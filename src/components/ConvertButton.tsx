'use client'

import { useRef } from 'react'
import { Loader2, Wand2, X } from 'lucide-react'
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

  // Tracks whether the current conversion was explicitly cancelled so we can
  // suppress the error state that bubbles up after workers are terminated.
  const cancelledRef = useRef(false)

  const titleOk = metadata.title.trim().length > 0
  const authorOk = metadata.author.trim().length > 0
  const filesOk = files.length > 0
  const isRunning = ACTIVE_STATUSES.has(progress.status)
  const disabled = !filesOk || !titleOk || !authorOk || isRunning

  const handleClick = async () => {
    cancelledRef.current = false
    setOutputBlob(null)
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
    } catch {
      // Errors are surfaced via the onProgress 'error' event above.
      // User input is preserved for retry.
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    cancelConversion()
  }

  const missing: string[] = []
  if (!filesOk) missing.push('add at least one audio file')
  if (!titleOk) missing.push('enter a title')
  if (!authorOk) missing.push('enter an author')

  return (
    <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md bg-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
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
      {disabled && !isRunning && missing.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          To enable: {missing.join(', ')}.
        </p>
      )}
    </div>
  )
}
