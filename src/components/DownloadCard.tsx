'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, RotateCcw } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { formatBytes } from '@/lib/audio/format'

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

export default function DownloadCard() {
  const outputBlob = useConversionStore((s) => s.outputBlob)
  const metadata = useConversionStore((s) => s.metadata)
  const reset = useConversionStore((s) => s.reset)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!outputBlob) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(outputBlob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [outputBlob])

  if (!outputBlob || !url) return null

  const safeAuthor = sanitizeFilename(metadata.author) || 'Unknown Author'
  const safeTitle = sanitizeFilename(metadata.title) || 'Untitled'
  const filename = `${safeAuthor} - ${safeTitle}.m4b`

  return (
    <div
      className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"
      role="status"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Your audiobook is ready
          </p>
          <p className="mt-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-300">
            {filename} · {formatBytes(outputBlob.size)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={url}
          download={filename}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Download size={16} aria-hidden="true" />
          Download M4B
        </a>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Start over
        </button>
      </div>
    </div>
  )
}
