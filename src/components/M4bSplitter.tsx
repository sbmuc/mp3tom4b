'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileAudio,
  Loader2,
  RotateCcw,
  Scissors,
  Upload,
  X,
} from 'lucide-react'
import { track } from '@vercel/analytics'
import { splitM4B, type SplitResult } from '@/lib/ffmpeg/split'
import { probeChapters, type Chapter } from '@/lib/ffmpeg/splitChapters'
import { terminateFFmpeg } from '@/lib/ffmpeg/client'
import { useWakeLock } from '@/lib/hooks/useWakeLock'
import { extractMetadata } from '@/lib/audio/metadata'
import { estimateOutputBytes, formatEstimatedSize } from '@/lib/audio/bitrate'
import { formatBytes, formatDuration } from '@/lib/audio/format'
import type { Bitrate, ConversionProgress } from '@/types'

const ACCEPTED_EXTENSIONS = ['.m4b', '.m4a']
const ACTIVE_STATUSES = new Set(['loading-ffmpeg', 'encoding', 'muxing'])

const BITRATE_OPTIONS: { value: Bitrate; hint: string }[] = [
  { value: 64, hint: 'recommended for audiobooks (spoken word)' },
  { value: 96, hint: 'speech with light music or effects' },
  { value: 128, hint: 'higher quality, larger files' },
]

const idleProgress: ConversionProgress = { status: 'idle', percent: 0, label: '' }

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export default function M4bSplitter() {
  const [file, setFile] = useState<File | null>(null)
  const [probing, setProbing] = useState(false)
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [tags, setTags] = useState<{ album?: string; artist?: string }>({})
  const [inputError, setInputError] = useState<string | null>(null)

  const [bitrate, setBitrate] = useState<Bitrate>(64)
  const [progress, setProgress] = useState<ConversionProgress>(idleProgress)
  const [result, setResult] = useState<SplitResult | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)

  const cancelledRef = useRef(false)
  const isRunning = ACTIVE_STATUSES.has(progress.status)

  // Keep the screen awake so a long split isn't paused by device sleep.
  useWakeLock(isRunning)

  useEffect(() => {
    if (!isRunning) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isRunning])

  useEffect(() => {
    if (!result) {
      setDownloadUrl(null)
      setDownloaded(false)
      return
    }
    const url = URL.createObjectURL(result.blob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])

  const onDrop = useCallback(async (accepted: File[]) => {
    const candidate = accepted.find((f) => !f.name.startsWith('.'))
    if (!candidate) return
    if (!hasAcceptedExtension(candidate.name)) {
      setInputError('That is not an M4B file. This tool splits an existing M4B or M4A audiobook.')
      return
    }

    setInputError(null)
    setProgress(idleProgress)
    setResult(null)
    setChapters(null)
    setTags({})
    setFile(candidate)
    setProbing(true)

    try {
      const [chaps, meta] = await Promise.all([probeChapters(candidate), extractMetadata(candidate)])
      setChapters(chaps)
      setTags({ album: meta.title, artist: meta.author })
    } catch {
      setInputError('Could not read that file. It may be corrupt or not a valid M4B.')
      setFile(null)
    } finally {
      setProbing(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false })

  const handleSplit = async () => {
    if (!file || !chapters || isRunning) return
    cancelledRef.current = false
    setResult(null)
    const startedAt = Date.now()
    try {
      const res = await splitM4B({
        file,
        bitrate,
        chapters,
        meta: { album: tags.album, artist: tags.artist },
        onProgress: (p) => {
          if (!cancelledRef.current) setProgress(p)
        },
      })
      setResult(res)
      track('m4b_split', {
        bitrateKbps: bitrate,
        chapterCount: chapters.length,
        outputCount: res.count,
        inputMb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
        elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      })
    } catch {
      // Error surfaced via the onProgress 'error' event.
    }
  }

  const handleCancel = () => {
    cancelledRef.current = true
    terminateFFmpeg()
    setProgress(idleProgress)
  }

  const handleReset = () => {
    setFile(null)
    setChapters(null)
    setTags({})
    setInputError(null)
    setProgress(idleProgress)
    setResult(null)
    setBitrate(64)
  }

  const chapterCount = chapters?.length ?? 0
  const totalMs = chapters?.reduce((max, c) => Math.max(max, c.endMs), 0) ?? 0
  const totalSec = totalMs / 1000
  const estimatedBytes = totalSec > 0 ? estimateOutputBytes(totalSec, bitrate) : 0
  const estimateLabel = formatEstimatedSize(estimatedBytes)

  return (
    <div className="mt-4">
      <div
        {...getRootProps()}
        role="button"
        aria-label="Drop an M4B or M4A audiobook here, or press Enter to browse"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
          isDragActive
            ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
            : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
      >
        <input {...getInputProps()} accept=".m4b,.m4a,audio/mp4,audio/x-m4a" />
        <Upload size={32} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        <p className="mt-3 text-base font-medium text-zinc-800 dark:text-zinc-100">
          {isDragActive ? 'Drop your M4B here' : 'Drop an M4B, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          M4B · M4A · one file · split into per-chapter MP3s
        </p>
      </div>

      {inputError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {inputError} To build an M4B from separate files, use the{' '}
            <Link href="/" className="underline hover:no-underline">
              main converter
            </Link>
            .
          </span>
        </div>
      )}

      {probing && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <Loader2 size={16} className="animate-spin text-accent-600 dark:text-accent-400" aria-hidden="true" />
          Reading chapters…
        </div>
      )}

      {file && chapters && !probing && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <FileAudio size={20} className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{file.name}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span>{formatBytes(file.size)}</span>
                {totalSec > 0 && <span>· {formatDuration(totalSec)}</span>}
                <span>· {chapterCount > 0 ? `${chapterCount} chapters` : 'no chapters'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Remove file"
              className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:text-zinc-200"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {chapterCount > 0 ? (
            <ol className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              {chapters!.map((c, i) => (
                <li key={i} className="flex items-baseline gap-2 px-1 text-sm">
                  <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-300">
                    {c.title?.trim() || `Chapter ${i + 1}`}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDuration(Math.max(0, (c.endMs - c.startMs) / 1000))}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              No chapters found — the whole file will be exported as a single MP3.
            </p>
          )}
        </div>
      )}

      {file && chapters && !probing && (
        <>
          <section aria-label="Output bitrate" className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">MP3 bitrate</h2>
            <div role="radiogroup" aria-label="MP3 bitrate" className="flex flex-col gap-2">
              {BITRATE_OPTIONS.map((opt) => {
                const selected = opt.value === bitrate
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-baseline gap-3 rounded-md border p-3 transition-colors ${
                      selected
                        ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="split-bitrate"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setBitrate(opt.value)}
                      className="h-4 w-4 shrink-0 self-center accent-accent-600"
                    />
                    <span className="flex-1">
                      <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {opt.value} kbps
                      </span>
                      <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">· {opt.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            {estimateLabel && (
              <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                Estimated total: {estimateLabel} at {bitrate} kbps
                {chapterCount > 0 && ` · ${chapterCount} MP3 files in a ZIP`}
              </p>
            )}
          </section>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSplit}
              aria-disabled={isRunning || undefined}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                isRunning ? 'cursor-not-allowed bg-accent-600/50' : 'bg-accent-600 hover:bg-accent-700'
              }`}
            >
              {isRunning ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Scissors size={16} aria-hidden="true" />
              )}
              {isRunning ? 'Splitting…' : chapterCount > 0 ? 'Split to MP3' : 'Convert to MP3'}
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
        </>
      )}

      {isRunning && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" aria-live="polite">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-zinc-800 dark:text-zinc-100">{progress.label}</span>
            <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">{progress.percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Split progress"
            className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
          >
            <div className="h-full bg-accent-500 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Splitting locally in your browser — no upload needed. Your screen stays awake; just keep this tab open until it finishes.
          </p>
        </div>
      )}

      {progress.status === 'error' && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Split failed.</p>
            <p className="mt-0.5 break-words">{progress.label || 'An unknown error occurred.'}</p>
          </div>
          <button
            type="button"
            onClick={() => setProgress(idleProgress)}
            className="rounded px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40"
          >
            Dismiss
          </button>
        </div>
      )}

      {result && downloadUrl && (
        <div
          className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                {result.count > 1 ? `Your ${result.count} MP3 files are ready` : 'Your MP3 is ready'}
              </p>
              <p className="mt-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                {result.filename} · {formatBytes(result.blob.size)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={downloadUrl}
              download={result.filename}
              onClick={() => setDownloaded(true)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                downloaded
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {downloaded ? <Check size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              {downloaded ? 'Downloaded ✓' : result.count > 1 ? 'Download ZIP' : 'Download MP3'}
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Split another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
