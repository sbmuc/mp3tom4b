'use client'

import { useRef } from 'react'
import { Loader2, Wand2, X } from 'lucide-react'
import { trackEvent, trackFailure } from '@/lib/analytics'
import { resetFFmpegAfterFailure } from '@/lib/ffmpeg/client'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import { editM4B } from '@/lib/ffmpeg/editM4b'
import { buildKey, useConversionStore, type LastBuild } from '@/lib/store/conversionStore'

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
  const lastBuild = useConversionStore((s) => s.lastBuild)
  const setLastBuild = useConversionStore((s) => s.setLastBuild)
  const setShortChapters = useConversionStore((s) => s.setShortChapters)

  // Tracks whether the current conversion was explicitly cancelled so we can
  // suppress the error state that bubbles up after workers are terminated.
  const cancelledRef = useRef(false)

  const titleOk = metadata.title.trim().length > 0
  const authorOk = metadata.author.trim().length > 0
  const filesOk = files.length > 0
  // A file we couldn't read at drop time would only fail mid-conversion, after
  // the user has already waited — block until it's removed.
  const unreadableCount = files.filter((f) => f.unreadable).length
  const readableOk = unreadableCount === 0
  const isRunning = ACTIVE_STATUSES.has(progress.status)
  // Same files, order and bitrate as the last M4B: only titles, tags or the
  // cover changed, and they go onto that M4B without encoding again.
  const canUpdate = lastBuild != null && lastBuild.key === buildKey(files, bitrate)
  const invalid = !filesOk || !titleOk || !authorOk || !readableOk

  const missing: string[] = []
  if (!filesOk) missing.push('add at least one audio file')
  if (!readableOk) {
    missing.push(`remove ${unreadableCount} file${unreadableCount === 1 ? '' : 's'} that could not be read`)
  }
  if (!titleOk) missing.push('enter a title')
  if (!authorOk) missing.push('enter an author')

  /**
   * Put the current titles, tags and cover on the last M4B: a remux with the
   * audio copied, as the editor does, so it takes a moment instead of a
   * whole encode. The chapter times stay those of the last M4B.
   */
  const updateLastBuild = async (build: LastBuild) => {
    const startedAt = Date.now()
    try {
      const blob = await editM4B({
        file: new File([build.blob], 'converted.m4b', { type: 'audio/mp4' }),
        chapters: files.map((f, i) => ({ startMs: build.starts[i] ?? 0, title: f.chapterTitle.trim() || `Chapter ${i + 1}` })),
        metadata,
        cover: coverFile === build.cover ? { mode: 'keep' } : coverFile ? { mode: 'replace', file: coverFile } : { mode: 'remove' },
        durationMs: build.durationMs,
        onProgress: (p) => {
          if (cancelledRef.current) return
          setProgress(p.status === 'muxing' ? { ...p, label: 'Updating titles, tags and cover (no re-encoding)…' } : p)
        },
      })
      setOutputBlob(blob)
      setLastBuild({ ...build, blob, cover: coverFile })
      trackEvent('conversion_updated', {
        fileCount: files.length,
        elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      })
    } catch (err) {
      if (!cancelledRef.current) {
        trackFailure('convert', err, { quickUpdate: true, elapsedSec: Math.round((Date.now() - startedAt) / 1000) })
        resetFFmpegAfterFailure()
      }
    }
  }

  const handleClick = async () => {
    if (isRunning) return
    if (invalid) {
      // Reveal hidden form errors and move focus to the first missing field
      // so screen-reader users get an immediate, clear signal.
      setSubmitAttempted(true)
      if (!filesOk) {
        const zone = document.getElementById('dropzone')
        zone?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        zone?.focus({ preventScroll: true })
      } else if (!readableOk) {
        // The row says what's wrong and its remove button fixes it. The drop
        // zone sits at the top of the page, so the row could stay out of view.
        const row = document.querySelector<HTMLElement>('[data-unreadable]')
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        row?.querySelector<HTMLElement>('[data-remove-file]')?.focus({ preventScroll: true })
      } else if (!titleOk) {
        document.getElementById('md-title')?.focus()
      } else if (!authorOk) {
        document.getElementById('md-author')?.focus()
      }
      return
    }

    cancelledRef.current = false
    setOutputBlob(null)
    if (canUpdate && lastBuild) {
      await updateLastBuild(lastBuild)
      return
    }
    // Let go of the previous M4B before encoding: a big book shouldn't be
    // held twice at the moment memory is tightest.
    setLastBuild(null)
    setShortChapters([])
    const startedAt = Date.now()
    const shape = {
      fileCount: files.length,
      bitrateKbps: bitrate,
      audioDurationSec: Math.round(files.reduce((acc, f) => acc + (f.duration ?? 0), 0)),
    }
    try {
      const result = await convertToM4B({
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
      const blob = result.blob
      setOutputBlob(blob)
      setShortChapters(result.shortChapters)
      setLastBuild({
        blob,
        key: buildKey(files, bitrate),
        starts: result.starts,
        durationMs: result.durationMs,
        cover: coverFile,
      })

      // Funnel telemetry: how often does a landed visitor finish a conversion?
      // Anonymous and cookieless (see lib/analytics.ts): no file content, only
      // aggregate shape metrics.
      trackEvent('conversion_completed', {
        ...shape,
        genre: metadata.genre,
        outputMb: Math.round((blob.size / (1024 * 1024)) * 10) / 10,
        elapsedSec: Math.round((Date.now() - startedAt) / 1000),
        hasCover: coverFile != null,
        shortChapters: result.shortChapters.length,
      })
    } catch (err) {
      // Errors are surfaced via the onProgress 'error' event above.
      // User input is preserved for retry.
      if (!cancelledRef.current) {
        trackFailure('convert', err, { ...shape, elapsedSec: Math.round((Date.now() - startedAt) / 1000) })
        resetFFmpegAfterFailure()
      }
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
          {isRunning ? (canUpdate ? 'Updating…' : 'Converting…') : canUpdate ? 'Update M4B' : 'Convert to M4B'}
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
