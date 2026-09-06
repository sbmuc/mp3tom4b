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
  ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { track } from '@vercel/analytics'
import { editM4B, type CoverMode } from '@/lib/ffmpeg/editM4b'
import { probeChapters } from '@/lib/ffmpeg/splitChapters'
import { terminateFFmpeg } from '@/lib/ffmpeg/client'
import { useWakeLock } from '@/lib/hooks/useWakeLock'
import { extractMetadata } from '@/lib/audio/metadata'
import { isDecodableImage } from '@/lib/image/validate'
import { formatBytes } from '@/lib/audio/format'
import type { ConversionMetadata, ConversionProgress, Genre } from '@/types'

const ACCEPTED_EXTENSIONS = ['.m4b', '.m4a']
const ACTIVE_STATUSES = new Set(['loading-ffmpeg', 'muxing'])
const GENRES: Genre[] = ['Audiobook', 'Podcast', 'Lecture', 'Other']
const idleProgress: ConversionProgress = { status: 'idle', percent: 0, label: '' }

interface Row {
  id: string
  timeStr: string
  title: string
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function fileBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function sanitizeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim()
}

function formatTimecode(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** Parse "H:MM:SS", "MM:SS", or plain seconds → ms, or null if invalid. */
function parseTimecode(str: string): number | null {
  const parts = str.trim().split(':').map((p) => p.trim())
  if (parts.length === 0 || parts.length > 3) return null
  if (parts.some((p) => p === '' || !/^\d+(\.\d+)?$/.test(p))) return null
  const n = parts.map(Number)
  let sec: number
  if (n.length === 1) sec = n[0]
  else if (n.length === 2) sec = n[0] * 60 + n[1]
  else sec = n[0] * 3600 + n[1] * 60 + n[2]
  if (!Number.isFinite(sec) || sec < 0) return null
  return Math.round(sec * 1000)
}

export default function M4bEditor() {
  const [file, setFile] = useState<File | null>(null)
  const [probing, setProbing] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)

  const [rows, setRows] = useState<Row[]>([])
  const [metadata, setMetadata] = useState<ConversionMetadata>({
    title: '',
    author: '',
    narrator: '',
    year: '',
    genre: 'Audiobook',
  })
  const [durationMs, setDurationMs] = useState(0)

  // Cover: object URLs are derived from the File objects via effects, so their
  // lifecycle (revoke) is handled automatically.
  const [coverMode, setCoverMode] = useState<CoverMode>('keep')
  const [originalCoverFile, setOriginalCoverFile] = useState<File | null>(null)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [replaceUrl, setReplaceUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)

  const [progress, setProgress] = useState<ConversionProgress>(idleProgress)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)

  const cancelledRef = useRef(false)
  const isRunning = ACTIVE_STATUSES.has(progress.status)

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
    if (!originalCoverFile) {
      setOriginalUrl(null)
      return
    }
    const url = URL.createObjectURL(originalCoverFile)
    setOriginalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [originalCoverFile])

  useEffect(() => {
    if (!replaceFile) {
      setReplaceUrl(null)
      return
    }
    const url = URL.createObjectURL(replaceFile)
    setReplaceUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [replaceFile])

  useEffect(() => {
    if (!resultBlob) {
      setDownloadUrl(null)
      setDownloaded(false)
      return
    }
    const url = URL.createObjectURL(resultBlob)
    setDownloadUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [resultBlob])

  const coverPreview = coverMode === 'remove' ? null : coverMode === 'replace' ? replaceUrl : originalUrl
  const hadOriginal = originalCoverFile !== null

  const handleReset = () => {
    setFile(null)
    setRows([])
    setMetadata({ title: '', author: '', narrator: '', year: '', genre: 'Audiobook' })
    setDurationMs(0)
    setCoverMode('keep')
    setOriginalCoverFile(null)
    setReplaceFile(null)
    setCoverError(null)
    setInputError(null)
    setProgress(idleProgress)
    setResultBlob(null)
  }

  const onDrop = useCallback(async (accepted: File[]) => {
    const candidate = accepted.find((f) => !f.name.startsWith('.'))
    if (!candidate) return
    if (!hasAcceptedExtension(candidate.name)) {
      setInputError('That is not an M4B file. This tool edits an existing M4B or M4A audiobook.')
      return
    }
    setInputError(null)
    setProgress(idleProgress)
    setResultBlob(null)
    setCoverMode('keep')
    setReplaceFile(null)
    setCoverError(null)
    setFile(candidate)
    setProbing(true)

    try {
      const [chaps, meta] = await Promise.all([probeChapters(candidate), extractMetadata(candidate)])
      setDurationMs(meta.durationMs ?? (chaps.length ? chaps[chaps.length - 1].endMs : 0))

      setRows(
        chaps.length > 0
          ? chaps.map((c) => ({ id: crypto.randomUUID(), timeStr: formatTimecode(c.startMs), title: c.title }))
          : [{ id: crypto.randomUUID(), timeStr: '0:00:00', title: 'Chapter 1' }],
      )

      setMetadata({
        title: meta.title ?? fileBaseName(candidate.name),
        author: meta.author ?? '',
        narrator: meta.narrator ?? '',
        year: meta.year ?? '',
        genre: meta.genre ?? 'Audiobook',
      })

      setOriginalCoverFile(meta.coverFile ?? null)
    } catch {
      setInputError('Could not read that file. It may be corrupt or not a valid M4B.')
      setFile(null)
    } finally {
      setProbing(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false })

  // ---- chapter rows ----
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))
  const addRow = () => setRows((rs) => [...rs, { id: crypto.randomUUID(), timeStr: '', title: `Chapter ${rs.length + 1}` }])
  const sortRows = () =>
    setRows((rs) =>
      [...rs].sort((a, b) => (parseTimecode(a.timeStr) ?? Infinity) - (parseTimecode(b.timeStr) ?? Infinity)),
    )

  // ---- cover actions ----
  const replaceCover = async (f: File) => {
    if (!(await isDecodableImage(f))) {
      setCoverError('That image could not be read. Try a different JPG or PNG.')
      return
    }
    setCoverError(null)
    setReplaceFile(f)
    setCoverMode('replace')
  }
  const removeCover = () => {
    setReplaceFile(null)
    setCoverMode('remove')
  }
  const keepOriginalCover = () => {
    setReplaceFile(null)
    setCoverMode('keep')
  }

  // ---- validation ----
  const parsedStarts = rows.map((r) => parseTimecode(r.timeStr))
  const anyInvalidTime = parsedStarts.some((s) => s === null)
  const sortedStarts = parsedStarts.filter((s): s is number => s !== null).sort((a, b) => a - b)
  const startsIncreasing = sortedStarts.every((v, i) => i === 0 || v > sortedStarts[i - 1])
  const hasZero = sortedStarts[0] === 0
  const withinDuration = durationMs > 0 ? sortedStarts.every((v) => v < durationMs) : true
  const yearOk = metadata.year === '' || /^\d{4}$/.test(metadata.year)

  let invalidReason: string | null = null
  if (rows.length === 0) invalidReason = 'Add at least one chapter.'
  else if (anyInvalidTime) invalidReason = 'Every chapter needs a valid time (e.g. 1:23:45).'
  else if (!hasZero) invalidReason = 'The first chapter must start at 0:00:00.'
  else if (!startsIncreasing) invalidReason = 'Chapter times must be unique and increasing.'
  else if (!withinDuration) invalidReason = `Chapter times must be within the book length (${formatTimecode(durationMs)}).`
  else if (!yearOk) invalidReason = 'Year must be 4 digits, or left empty.'
  const canSave = invalidReason === null

  const handleSave = async () => {
    if (!file || !canSave || isRunning) return
    cancelledRef.current = false
    setResultBlob(null)
    const startedAt = Date.now()
    try {
      const chapters = rows.map((r) => ({ startMs: parseTimecode(r.timeStr) ?? 0, title: r.title }))
      const blob = await editM4B({
        file,
        chapters,
        metadata,
        cover: { mode: coverMode, file: replaceFile },
        durationMs,
        onProgress: (p) => {
          if (!cancelledRef.current) setProgress(p)
        },
      })
      setResultBlob(blob)
      track('m4b_edited', {
        chapterCount: chapters.length,
        coverMode,
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

  const downloadName = (() => {
    const author = sanitizeFilename(metadata.author)
    const title = sanitizeFilename(metadata.title)
    if (author && title) return `${author} - ${title}.m4b`
    if (title) return `${title}.m4b`
    if (file) return `${sanitizeFilename(fileBaseName(file.name))} (edited).m4b`
    return 'audiobook.m4b'
  })()

  const inputBase =
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400 border-zinc-300 dark:border-zinc-700'
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'

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
          {isDragActive ? 'Drop your M4B here' : 'Drop an M4B to edit, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          M4B · M4A · one file · edits are saved without re-encoding
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
          Reading audiobook…
        </div>
      )}

      {file && !probing && (
        <>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <FileAudio size={20} className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{file.name}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {formatBytes(file.size)}
                {durationMs > 0 && ` · ${formatTimecode(durationMs)}`} · audio is copied, not re-encoded
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

          {/* Metadata */}
          <section aria-label="Audiobook details" className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Audiobook details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edit-title" className={labelClass}>Title</label>
                <input id="edit-title" type="text" value={metadata.title}
                  onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="edit-author" className={labelClass}>Author</label>
                <input id="edit-author" type="text" value={metadata.author}
                  onChange={(e) => setMetadata((m) => ({ ...m, author: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="edit-narrator" className={labelClass}>Narrator</label>
                <input id="edit-narrator" type="text" value={metadata.narrator}
                  onChange={(e) => setMetadata((m) => ({ ...m, narrator: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="edit-year" className={labelClass}>Year</label>
                <input id="edit-year" type="text" inputMode="numeric" maxLength={4} value={metadata.year}
                  onChange={(e) => setMetadata((m) => ({ ...m, year: e.target.value }))}
                  className={`${inputBase} font-mono ${yearOk ? '' : '!border-rose-400 dark:!border-rose-700'}`} />
              </div>
              <div>
                <label htmlFor="edit-genre" className={labelClass}>Genre</label>
                <select id="edit-genre" value={metadata.genre}
                  onChange={(e) => setMetadata((m) => ({ ...m, genre: e.target.value as Genre }))} className={inputBase}>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Cover */}
          <section aria-label="Cover image" className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Cover</h2>
            <div className="flex items-start gap-4">
              <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverPreview} alt="Cover" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon size={28} className="text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  {coverMode === 'remove'
                    ? 'The cover will be removed.'
                    : coverMode === 'replace'
                      ? 'Using a new cover image.'
                      : hadOriginal
                        ? 'Keeping the current cover.'
                        : 'No cover in this file — add one below.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    <ImageIcon size={12} aria-hidden="true" />
                    {hadOriginal || coverMode === 'replace' ? 'Replace image' : 'Add cover'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void replaceCover(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {coverMode !== 'remove' && (hadOriginal || coverMode === 'replace') && (
                    <button type="button" onClick={removeCover}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <X size={12} aria-hidden="true" /> Remove cover
                    </button>
                  )}
                  {coverMode !== 'keep' && hadOriginal && (
                    <button type="button" onClick={keepOriginalCover}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <RotateCcw size={12} aria-hidden="true" /> Keep original
                    </button>
                  )}
                </div>
                {coverError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{coverError}</p>}
              </div>
            </div>
          </section>

          {/* Chapters */}
          <section aria-label="Chapters" className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Chapters <span className="font-mono text-sm font-normal text-zinc-500 dark:text-zinc-400">({rows.length})</span>
              </h2>
              <button type="button" onClick={addRow}
                className="inline-flex items-center gap-1 rounded-md border border-accent-300 bg-accent-50 px-2.5 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-accent-500/40 dark:bg-accent-950/40 dark:text-accent-300">
                <Plus size={13} aria-hidden="true" /> Add chapter
              </button>
            </div>

            <ul className="flex flex-col gap-2">
              {rows.map((r) => {
                const valid = parseTimecode(r.timeStr) !== null
                return (
                  <li key={r.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <input
                      type="text"
                      value={r.timeStr}
                      onChange={(e) => updateRow(r.id, { timeStr: e.target.value })}
                      onBlur={sortRows}
                      aria-label="Chapter start time"
                      placeholder="0:00:00"
                      className={`w-24 shrink-0 rounded border bg-white px-2 py-1 text-center font-mono text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:bg-zinc-950 dark:text-zinc-100 ${
                        valid ? 'border-zinc-300 dark:border-zinc-700' : 'border-rose-400 dark:border-rose-700'
                      }`}
                    />
                    <input
                      type="text"
                      value={r.title}
                      onChange={(e) => updateRow(r.id, { title: e.target.value })}
                      aria-label="Chapter title"
                      placeholder="Chapter title"
                      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 hover:border-zinc-300 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/30 dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus:bg-zinc-950"
                    />
                    <button type="button" onClick={() => removeRow(r.id)} aria-label="Remove chapter"
                      className="shrink-0 rounded p-1 text-zinc-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-zinc-500 dark:hover:text-rose-400">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Times are measured from the start of the book (H:MM:SS). The list reorders itself by time as you edit.
            </p>
          </section>

          {/* Save */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              aria-disabled={!canSave || isRunning || undefined}
              aria-describedby={!canSave ? 'edit-help' : undefined}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                !canSave || isRunning ? 'cursor-not-allowed bg-accent-600/50' : 'bg-accent-600 hover:bg-accent-700'
              }`}
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {isRunning ? 'Saving…' : 'Save M4B'}
            </button>
            {isRunning && (
              <button type="button" onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <X size={14} aria-hidden="true" /> Cancel
              </button>
            )}
            {!canSave && !isRunning && invalidReason && (
              <p id="edit-help" className="text-xs text-zinc-500 dark:text-zinc-400">{invalidReason}</p>
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
          <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Save progress"
            className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-accent-500 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Saving locally in your browser — no upload needed. Your screen stays awake; just keep this tab open until it finishes.
          </p>
        </div>
      )}

      {progress.status === 'error' && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Save failed.</p>
            <p className="mt-0.5 break-words">{progress.label || 'An unknown error occurred.'}</p>
          </div>
          <button type="button" onClick={() => setProgress(idleProgress)}
            className="rounded px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40">
            Dismiss
          </button>
        </div>
      )}

      {resultBlob && downloadUrl && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Your edited audiobook is ready</p>
              <p className="mt-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                {downloadName} · {formatBytes(resultBlob.size)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={downloadUrl} download={downloadName} onClick={() => setDownloaded(true)}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                downloaded
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}>
              {downloaded ? <Check size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              {downloaded ? 'Downloaded ✓' : 'Download M4B'}
            </a>
            <button type="button" onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
              <RotateCcw size={14} aria-hidden="true" /> Edit another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
