'use client'

import { Loader2, Wand2 } from 'lucide-react'
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

  const titleOk = metadata.title.trim().length > 0
  const authorOk = metadata.author.trim().length > 0
  const filesOk = files.length > 0
  const isRunning = ACTIVE_STATUSES.has(progress.status)
  const disabled = !filesOk || !titleOk || !authorOk || isRunning

  const handleClick = async () => {
    setOutputBlob(null)
    try {
      const blob = await convertToM4B({
        files,
        metadata,
        coverFile,
        bitrate,
        onProgress: setProgress,
      })
      setOutputBlob(blob)
    } catch {
      // The pipeline already emits an `error` progress event with the message.
      // User input is preserved — they can adjust and retry.
    }
  }

  const missing: string[] = []
  if (!filesOk) missing.push('add at least one audio file')
  if (!titleOk) missing.push('enter a title')
  if (!authorOk) missing.push('enter an author')

  return (
    <div className="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
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
      {disabled && !isRunning && missing.length > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          To enable: {missing.join(', ')}.
        </p>
      )}
    </div>
  )
}
