'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Download, RotateCcw } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { formatBytes } from '@/lib/audio/format'

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

function ensureM4bExtension(name: string): string {
  return /\.m4b$/i.test(name) ? name : `${name}.m4b`
}

export default function DownloadCard() {
  const outputBlob = useConversionStore((s) => s.outputBlob)
  const metadata = useConversionStore((s) => s.metadata)
  const reset = useConversionStore((s) => s.reset)
  const [url, setUrl] = useState<string | null>(null)
  const [override, setOverride] = useState<string>('')
  const [downloaded, setDownloaded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!outputBlob) {
      setUrl(null)
      setOverride('')
      setDownloaded(false)
      setShowConfirm(false)
      return
    }
    const objectUrl = URL.createObjectURL(outputBlob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [outputBlob])

  if (!outputBlob || !url) return null

  const safeAuthor = sanitizeFilename(metadata.author) || 'Unknown Author'
  const safeTitle = sanitizeFilename(metadata.title) || 'Untitled'
  const autoFilename = `${safeAuthor} - ${safeTitle}.m4b`

  const overrideTrimmed = override.trim()
  const resolved = overrideTrimmed
    ? ensureM4bExtension(sanitizeFilename(overrideTrimmed) || autoFilename)
    : autoFilename
  const isCustom = overrideTrimmed.length > 0 && resolved !== autoFilename

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
            {resolved} · {formatBytes(outputBlob.size)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor="output-filename"
          className="block text-xs font-medium text-emerald-900 dark:text-emerald-100"
        >
          Filename <span className="font-normal text-emerald-700/70 dark:text-emerald-300/70">(optional)</span>
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id="output-filename"
            type="text"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder={autoFilename}
            className="min-w-0 flex-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
          {isCustom && (
            <button
              type="button"
              onClick={() => setOverride('')}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-200 dark:hover:bg-zinc-900"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {downloaded ? (
          <a
            href={url}
            download={resolved}
            onClick={() => setDownloaded(true)}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
          >
            <Check size={16} aria-hidden="true" />
            Downloaded ✓
          </a>
        ) : (
          <a
            href={url}
            download={resolved}
            onClick={() => setDownloaded(true)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Download size={16} aria-hidden="true" />
            Download M4B
          </a>
        )}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RotateCcw size={14} aria-hidden="true" />
          Start over
        </button>
      </div>

      {showConfirm && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Start a new conversion?</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Your current files and settings will be cleared.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              Start Over
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
