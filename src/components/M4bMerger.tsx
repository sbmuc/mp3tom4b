'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  Loader,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { track } from '@vercel/analytics'
import {
  analyzeCompatibility,
  mergeM4B,
  type MergeChapterMode,
  type MergeCoverMode,
} from '@/lib/ffmpeg/mergeM4b'
import { probeChapters, type Chapter } from '@/lib/ffmpeg/splitChapters'
import { probeM4bInfo } from '@/lib/ffmpeg/probeM4b'
import { terminateFFmpeg } from '@/lib/ffmpeg/client'
import { useWakeLock } from '@/lib/hooks/useWakeLock'
import { useEta } from '@/lib/hooks/useEta'
import { extractMetadata } from '@/lib/audio/metadata'
import { isDecodableImage } from '@/lib/image/validate'
import { fileNameToChapterTitle, formatBytes, formatDuration } from '@/lib/audio/format'
import type { Bitrate, ConversionMetadata, ConversionProgress, Genre } from '@/types'
import OutputPreview from '@/components/OutputPreview'

const ACCEPTED_EXTENSIONS = ['.m4b', '.m4a']
const ACTIVE_STATUSES = new Set(['loading-ffmpeg', 'encoding', 'concatenating', 'muxing'])
const GENRES: Genre[] = ['Audiobook', 'Podcast', 'Lecture', 'Other']
const BITRATES: Bitrate[] = [64, 96, 128]
const idleProgress: ConversionProgress = { status: 'idle', percent: 0, label: '' }

interface PartRow {
  id: string
  file: File
  status: 'probing' | 'ready' | 'error'
  durationMs: number
  chapters: Chapter[]
  chapterCount: number
  /** Embedded cover art, if any — used for the cover picker + preview. */
  coverFile: File | null
  title: string
  codec: string | null
  sampleRate: number | null
  channelLayout: string | null
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

function SortablePartRow({
  row,
  index,
  onRemove,
  disabled,
}: {
  row: PartRow
  index: number
  onRemove: (id: string) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Reorder ${row.file.name}`}
        className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-200"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      <span className="w-6 shrink-0 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">{index + 1}.</span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-900 dark:text-zinc-100" title={row.file.name}>
          {row.file.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
          {row.status === 'probing' ? (
            <span className="inline-flex items-center gap-1">
              <Loader size={11} className="animate-spin" aria-hidden="true" /> reading…
            </span>
          ) : row.status === 'error' ? (
            <span className="text-rose-600 dark:text-rose-400">could not read this file</span>
          ) : (
            <>
              {formatBytes(row.file.size)} · {formatDuration(Math.round(row.durationMs / 1000))} ·{' '}
              {row.chapterCount > 0 ? `${row.chapterCount} chapter${row.chapterCount === 1 ? '' : 's'}` : 'no chapters'}
            </>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(row.id)}
        aria-label={`Remove ${row.file.name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-zinc-500 dark:hover:text-rose-400"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  )
}

export default function M4bMerger() {
  const [rows, setRows] = useState<PartRow[]>([])
  const [inputError, setInputError] = useState<string | null>(null)
  const [showConverterHint, setShowConverterHint] = useState(false)

  const [metadata, setMetadata] = useState<ConversionMetadata>({
    title: '',
    author: '',
    narrator: '',
    year: '',
    genre: 'Audiobook',
  })
  const [chapterMode, setChapterMode] = useState<MergeChapterMode>('keep')
  const [bitrate, setBitrate] = useState<Bitrate>(64)

  // Cover: kept from one of the input files (coverSourceId), replaced with an
  // upload, or removed. coverSourceId null falls back to the first file that has
  // a cover.
  const [coverMode, setCoverMode] = useState<MergeCoverMode>('keep')
  const [coverSourceId, setCoverSourceId] = useState<string | null>(null)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [replaceUrl, setReplaceUrl] = useState<string | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)

  const [progress, setProgress] = useState<ConversionProgress>(idleProgress)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)

  const prefilledRef = useRef(false)
  const cancelledRef = useRef(false)
  const isRunning = ACTIVE_STATUSES.has(progress.status)

  useWakeLock(isRunning)
  const eta = useEta(progress.percent, isRunning)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!isRunning) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isRunning])

  // Object URLs for each file's embedded cover, for the picker + preview.
  const coverSig = rows.map((r) => `${r.id}:${r.coverFile ? r.coverFile.size : 0}`).join('|')
  useEffect(() => {
    const map: Record<string, string> = {}
    for (const r of rows) {
      if (r.coverFile) map[r.id] = URL.createObjectURL(r.coverFile)
    }
    setCoverUrls(map)
    return () => Object.values(map).forEach((u) => URL.revokeObjectURL(u))
    // Rebuilt only when the set of covers changes, not on every reorder/probe tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverSig])

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

  // The effective cover source: the user's pick if it still has a cover,
  // otherwise the first file in order that has one.
  const coversAvailable = rows.filter((r) => r.coverFile)
  const effectiveCoverSourceId =
    coverSourceId && coversAvailable.some((r) => r.id === coverSourceId)
      ? coverSourceId
      : (coversAvailable[0]?.id ?? null)
  const hadOriginal = effectiveCoverSourceId !== null
  const coverPreview =
    coverMode === 'remove'
      ? null
      : coverMode === 'replace'
        ? replaceUrl
        : effectiveCoverSourceId
          ? coverUrls[effectiveCoverSourceId] ?? null
          : null

  const probeRow = useCallback(async (id: string, file: File) => {
    try {
      const [chapters, info, meta] = await Promise.all([
        probeChapters(file),
        probeM4bInfo(file),
        extractMetadata(file),
      ])
      const durationMs = info.durationMs ?? (chapters.length ? chapters[chapters.length - 1].endMs : 0)
      setRows((rs) =>
        rs.map((r) =>
          r.id === id
            ? {
                ...r,
                status: 'ready',
                durationMs,
                chapters,
                chapterCount: chapters.length,
                coverFile: meta.coverFile ?? null,
                codec: info.codec,
                sampleRate: info.sampleRate,
                channelLayout: info.channelLayout,
              }
            : r,
        ),
      )
    } catch {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: 'error' } : r)))
    }
  }, [])

  const onDrop = useCallback(
    (accepted: File[]) => {
      const files = accepted.filter((f) => !f.name.startsWith('.'))
      const supported = files.filter((f) => hasAcceptedExtension(f.name))
      const unsupported = files.length - supported.length

      // Skip files already in the list (and repeats within this drop). A file is
      // treated as the same when its name and size match — the same audio twice
      // is almost always a mistake in a merge.
      const seen = new Set(rows.map((r) => `${r.file.name}::${r.file.size}`))
      const good: File[] = []
      let duplicates = 0
      for (const f of supported) {
        const key = `${f.name}::${f.size}`
        if (seen.has(key)) {
          duplicates++
          continue
        }
        seen.add(key)
        good.push(f)
      }

      const notices: string[] = []
      if (duplicates > 0) notices.push(`${duplicates} already in the list`)
      if (unsupported > 0) notices.push(`${unsupported} not an M4B or M4A file`)
      setInputError(notices.length ? `Skipped ${notices.join(' and ')}.` : null)
      setShowConverterHint(unsupported > 0)
      if (good.length === 0) return

      setProgress(idleProgress)
      setResultBlob(null)

      const newRows: PartRow[] = good.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'probing',
        durationMs: 0,
        chapters: [],
        chapterCount: 0,
        coverFile: null,
        title: fileNameToChapterTitle(file.name),
        codec: null,
        sampleRate: null,
        channelLayout: null,
      }))
      setRows((rs) => [...rs, ...newRows])
      newRows.forEach((r) => void probeRow(r.id, r.file))

      // Prefill book metadata from the first file added, once.
      if (!prefilledRef.current && good[0]) {
        prefilledRef.current = true
        void extractMetadata(good[0]).then((m) =>
          setMetadata((prev) => ({
            title: prev.title || m.title || fileBaseName(good[0].name),
            author: prev.author || m.author || '',
            narrator: prev.narrator || m.narrator || '',
            year: prev.year || m.year || '',
            genre: prev.genre !== 'Audiobook' ? prev.genre : m.genre ?? 'Audiobook',
          })),
        )
      }
    },
    [probeRow, rows],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((rs) => {
      const from = rs.findIndex((r) => r.id === active.id)
      const to = rs.findIndex((r) => r.id === over.id)
      if (from === -1 || to === -1) return rs
      const next = [...rs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id))

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
  const pickFileCover = (id?: string) => {
    setReplaceFile(null)
    if (id) setCoverSourceId(id)
    setCoverMode('keep')
  }

  const handleReset = () => {
    setRows([])
    setInputError(null)
    setShowConverterHint(false)
    setMetadata({ title: '', author: '', narrator: '', year: '', genre: 'Audiobook' })
    setChapterMode('keep')
    setBitrate(64)
    setCoverMode('keep')
    setCoverSourceId(null)
    setReplaceFile(null)
    setCoverError(null)
    setProgress(idleProgress)
    setResultBlob(null)
    prefilledRef.current = false
  }

  // ---- derived state ----
  const readyRows = rows.filter((r) => r.status === 'ready')
  const anyProbing = rows.some((r) => r.status === 'probing')
  const anyError = rows.some((r) => r.status === 'error')
  const totalDurationMs = readyRows.reduce((sum, r) => sum + r.durationMs, 0)
  const totalChapters = readyRows.reduce((sum, r) => sum + Math.max(1, r.chapterCount), 0)
  const compat = analyzeCompatibility(
    readyRows.map((r) => ({ codec: r.codec, sampleRate: r.sampleRate, channelLayout: r.channelLayout })),
  )
  const reencode = readyRows.length >= 2 && !compat.canCopy
  const yearOk = metadata.year === '' || /^\d{4}$/.test(metadata.year)

  let invalidReason: string | null = null
  if (rows.length < 2) invalidReason = 'Add at least two M4B files to merge.'
  else if (anyProbing) invalidReason = 'Still reading files…'
  else if (anyError) invalidReason = 'Remove the files that could not be read.'
  else if (!metadata.title.trim()) invalidReason = 'Enter a title for the merged audiobook.'
  else if (!yearOk) invalidReason = 'Year must be 4 digits, or left empty.'
  const canMerge = invalidReason === null

  const handleMerge = async () => {
    if (!canMerge || isRunning) return
    cancelledRef.current = false
    setResultBlob(null)
    const startedAt = Date.now()
    try {
      const blob = await mergeM4B({
        files: readyRows.map((r) => r.file),
        parts: readyRows.map((r) => ({ chapters: r.chapters, durationMs: r.durationMs, title: r.title })),
        metadata,
        chapterMode,
        cover: { mode: coverMode, file: replaceFile },
        coverSourceIndex:
          coverMode === 'keep' && effectiveCoverSourceId
            ? readyRows.findIndex((r) => r.id === effectiveCoverSourceId)
            : null,
        reencode,
        bitrate,
        target: compat.target,
        totalDurationMs,
        onProgress: (p) => {
          if (!cancelledRef.current) setProgress(p)
        },
      })
      setResultBlob(blob)
      track('m4b_merged', {
        fileCount: readyRows.length,
        chapterMode,
        reencode,
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
    // Tag the output "(merged)" so it can't collide with the source files, which
    // usually sit in the same folder as the download.
    if (author && title) return `${author} - ${title} (merged).m4b`
    if (title) return `${title} (merged).m4b`
    return 'audiobook (merged).m4b'
  })()

  const inputBase =
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400 border-zinc-300 dark:border-zinc-700'
  const labelClass = 'mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'

  return (
    <div className="mt-4">
      <div
        {...getRootProps()}
        role="button"
        aria-label="Drop M4B or M4A files here, or press Enter to browse"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
          isDragActive
            ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
            : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
      >
        <input {...getInputProps()} accept=".m4b,.m4a,audio/mp4,audio/x-m4a" />
        <Upload size={32} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        <p className="mt-3 text-base font-medium text-zinc-800 dark:text-zinc-100">
          {isDragActive ? 'Drop your M4B files here' : rows.length > 0 ? 'Add more files, or click to browse' : 'Drop your M4B files to merge, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          M4B · M4A · two or more files · combined in the order below
        </p>
      </div>

      {inputError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {inputError}
            {showConverterHint && (
              <>
                {' '}To build an M4B from MP3s or other audio, use the{' '}
                <Link href="/" className="underline hover:no-underline">
                  main converter
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Part list */}
          <section aria-label="Files to merge" className="mt-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Files to merge{' '}
                <span className="font-mono text-sm font-normal text-zinc-500 dark:text-zinc-400">({rows.length})</span>
              </h2>
              {readyRows.length > 0 && (
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDuration(Math.round(totalDurationMs / 1000))} total · ~{totalChapters} chapters
                </p>
              )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {rows.map((row, index) => (
                    <SortablePartRow key={row.id} row={row} index={index} onRemove={removeRow} disabled={isRunning} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Drag to reorder, or tab to a handle and use ↑ ↓. The books are joined top-to-bottom; chapters are placed on
              one continuous timeline.
            </p>
          </section>

          {/* Re-encode notice */}
          {reencode && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-100">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                These files use different audio settings, so they&apos;ll be re-encoded to a common format to join
                cleanly. This is slower than a plain merge. Pick a bitrate below.
              </span>
            </div>
          )}

          {/* Options */}
          <section aria-label="Merge options" className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Chapters</span>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { v: 'keep', label: "Keep each file's own chapters" },
                    { v: 'perFile', label: 'One chapter per file' },
                  ] as const
                ).map(({ v, label }) => (
                  <label key={v} className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="radio"
                      name="chapterMode"
                      checked={chapterMode === v}
                      onChange={() => setChapterMode(v)}
                      className="accent-accent-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {reencode && (
              <div>
                <span className={labelClass}>Bitrate</span>
                <div className="inline-flex overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700" role="group" aria-label="Bitrate">
                  {BITRATES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBitrate(b)}
                      aria-pressed={bitrate === b}
                      className={`px-3 py-2 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                        bitrate === b
                          ? 'bg-accent-600 text-white'
                          : 'bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {b}k
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">64 kbps is the audiobook standard.</p>
              </div>
            )}
          </section>

          {/* Metadata */}
          <section aria-label="Audiobook details" className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Audiobook details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="merge-title" className={labelClass}>Title</label>
                <input id="merge-title" type="text" value={metadata.title}
                  onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="merge-author" className={labelClass}>Author</label>
                <input id="merge-author" type="text" value={metadata.author}
                  onChange={(e) => setMetadata((m) => ({ ...m, author: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="merge-narrator" className={labelClass}>Narrator</label>
                <input id="merge-narrator" type="text" value={metadata.narrator}
                  onChange={(e) => setMetadata((m) => ({ ...m, narrator: e.target.value }))} className={inputBase} />
              </div>
              <div>
                <label htmlFor="merge-year" className={labelClass}>Year</label>
                <input id="merge-year" type="text" inputMode="numeric" maxLength={4} value={metadata.year}
                  onChange={(e) => setMetadata((m) => ({ ...m, year: e.target.value }))}
                  className={`${inputBase} font-mono ${yearOk ? '' : '!border-rose-400 dark:!border-rose-700'}`} />
              </div>
              <div>
                <label htmlFor="merge-genre" className={labelClass}>Genre</label>
                <select id="merge-genre" value={metadata.genre}
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
              {/* Always white: the embedded cover is letterboxed onto white, so a
                  dark frame would misrepresent the actual output in dark mode. */}
              <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800">
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
                    ? 'The merged file will have no cover.'
                    : coverMode === 'replace'
                      ? 'Using a new cover image.'
                      : hadOriginal
                        ? coversAvailable.length >= 2
                          ? "Using the selected file's cover below."
                          : "Keeping the audiobook's cover."
                        : 'No cover found in these files — add one below.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                    <ImageIcon size={12} aria-hidden="true" />
                    {hadOriginal || coverMode === 'replace' ? 'Upload a different image' : 'Add cover'}
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
                    <button type="button" onClick={() => pickFileCover()}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                      <RotateCcw size={12} aria-hidden="true" /> Use a file&apos;s cover
                    </button>
                  )}
                </div>
                {coverError && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{coverError}</p>}
              </div>
            </div>

            {/* Pick which file's embedded cover to use (only when there's a choice). */}
            {coversAvailable.length >= 2 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Choose which file&apos;s cover to use
                </p>
                <div className="flex flex-wrap gap-3">
                  {rows.map((r, i) =>
                    r.coverFile && coverUrls[r.id] ? (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pickFileCover(r.id)}
                        aria-pressed={coverMode === 'keep' && effectiveCoverSourceId === r.id}
                        title={r.file.name}
                        className={`relative shrink-0 overflow-hidden rounded-md border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                          coverMode === 'keep' && effectiveCoverSourceId === r.id
                            ? 'border-accent-500'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={coverUrls[r.id]} alt={`Cover from file ${i + 1}`} className="h-16 w-16 object-cover" />
                        <span className="absolute bottom-0 left-0 rounded-tr bg-black/60 px-1 font-mono text-[10px] text-white">
                          {i + 1}
                        </span>
                        {coverMode === 'keep' && effectiveCoverSourceId === r.id && (
                          <span className="absolute right-0.5 top-0.5 rounded-full bg-accent-500 p-0.5 text-white">
                            <Check size={10} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Merge */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleMerge}
              aria-disabled={!canMerge || isRunning || undefined}
              aria-describedby={!canMerge ? 'merge-help' : undefined}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                !canMerge || isRunning ? 'cursor-not-allowed bg-accent-600/50' : 'bg-accent-600 hover:bg-accent-700'
              }`}
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Layers size={16} aria-hidden="true" />}
              {isRunning ? 'Merging…' : 'Merge into one M4B'}
            </button>
            {isRunning && (
              <button type="button" onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
                <X size={14} aria-hidden="true" /> Cancel
              </button>
            )}
            {!canMerge && !isRunning && invalidReason && (
              <p id="merge-help" className="text-xs text-zinc-500 dark:text-zinc-400">{invalidReason}</p>
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
          <div role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Merge progress"
            className="mt-2 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            <div className="h-full bg-accent-500 transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          {eta && <p className="mt-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">{eta}</p>}
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Merging locally in your browser — no upload needed. Your screen stays awake; just keep this tab open until it finishes.
          </p>
        </div>
      )}

      {progress.status === 'error' && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Merge failed.</p>
            <p className="mt-0.5 break-words">{progress.label || 'An unknown error occurred.'}</p>
          </div>
          <button type="button" onClick={() => setProgress(idleProgress)}
            className="rounded px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40">
            Dismiss
          </button>
        </div>
      )}

      {resultBlob && downloadUrl && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3" role="status">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">Your merged audiobook is ready</p>
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
              <RotateCcw size={14} aria-hidden="true" /> Merge another
            </button>
          </div>
          <OutputPreview file={resultBlob} fileName={downloadName} />
        </div>
      )}
    </div>
  )
}
