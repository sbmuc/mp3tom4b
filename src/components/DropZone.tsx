'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { Bookmark, BookOpen, Image as ImageIcon, Upload, X } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { validateFiles } from '@/lib/audio/validate'
import { fileNameToChapterTitle } from '@/lib/audio/format'
import { extractMetadata } from '@/lib/audio/metadata'
import type { AudioFile, ExtractedMetadata } from '@/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
// Extensions silently discarded — no "skipped" notice
const JUNK_EXTENSIONS = new Set(['.txt', '.nfo', '.cue', '.log', '.m3u', '.m3u8', '.sfv', '.pdf', '.xml', '.json'])

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

type FileClass = 'audio' | 'image' | 'junk' | 'unknown'

function classifyFile(file: File): FileClass {
  if (file.name.startsWith('.')) return 'junk'
  const ext = getExt(file.name)
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (JUNK_EXTENSIONS.has(ext)) return 'junk'
  return 'unknown'
}

function pickBestCoverImage(images: File[]): File {
  if (images.length === 1) return images[0]
  const score = (f: File): number => {
    const n = f.name.replace(/\.[^.]+$/, '').toLowerCase()
    if (/^cover/.test(n)) return 5
    if (/^folder/.test(n)) return 4
    if (/^front/.test(n)) return 3
    if (/^album/.test(n)) return 2
    if (n.includes('cover')) return 1
    return 0
  }
  return [...images].sort((a, b) => {
    const sd = score(b) - score(a)
    return sd !== 0 ? sd : b.size - a.size
  })[0]
}

interface MatchableFile {
  id: string
  size: number
  durationMs: number | null
}

function fileSecondsToMs(seconds: number | null): number | null {
  return seconds == null ? null : Math.round(seconds * 1000)
}

function findDuplicate(
  candidate: { size: number; durationMs: number | null; name: string },
  pool: MatchableFile[]
): string | null {
  for (const existing of pool) {
    if (existing.size !== candidate.size) continue
    if (candidate.durationMs == null || existing.durationMs == null) {
      console.warn(
        `[mp3tom4b] Duplicate check fell back to size-only for "${candidate.name}" — duration data unavailable.`
      )
      return existing.id
    }
    if (existing.durationMs === candidate.durationMs) return existing.id
  }
  return null
}

interface DropNotice {
  id: string
  message: string
}

export default function DropZone() {
  const addFiles = useConversionStore((s) => s.addFiles)
  const applyAutoMetadata = useConversionStore((s) => s.applyAutoMetadata)
  const applySmartBitrate = useConversionStore((s) => s.applySmartBitrate)
  const setDuplicateNotice = useConversionStore((s) => s.setDuplicateNotice)
  const flashFiles = useConversionStore((s) => s.flashFiles)
  const setCoverFileDrop = useConversionStore((s) => s.setCoverFileDrop)
  const isEmpty = useConversionStore((s) => s.files.length === 0)

  const [notices, setNotices] = useState<DropNotice[]>([])
  const noticeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const folderNameRef = useRef<string | null>(null)

  const addNotice = useCallback((message: string) => {
    const id = crypto.randomUUID()
    setNotices((prev) => [...prev, { id, message }])
    const timer = setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id))
      noticeTimersRef.current.delete(id)
    }, 6000)
    noticeTimersRef.current.set(id, timer)
  }, [])

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id))
    const t = noticeTimersRef.current.get(id)
    if (t) { clearTimeout(t); noticeTimersRef.current.delete(id) }
  }, [])

  // Capture folder name from the raw drop event before react-dropzone processes it
  const captureDropInfo = useCallback((e: React.DragEvent) => {
    folderNameRef.current = null
    const items = e.dataTransfer?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry = (items[i] as any).webkitGetAsEntry?.()
      if (entry?.isDirectory) {
        folderNameRef.current = entry.name as string
        break
      }
    }
  }, [])

  const onDrop = useCallback(
    async (accepted: File[]) => {
      // Filter hidden files that come through in folder drops (.DS_Store, ._filename, etc.)
      const allFiles = accepted.filter((f) => !f.name.startsWith('.'))

      const audioFiles: File[] = []
      const imageFiles: File[] = []
      let unknownCount = 0

      for (const file of allFiles) {
        switch (classifyFile(file)) {
          case 'audio': audioFiles.push(file); break
          case 'image': imageFiles.push(file); break
          case 'junk': break
          default: unknownCount++
        }
      }

      // Cover image routing
      let coverSetThisDrop: File | null = null
      if (imageFiles.length > 0) {
        const state = useConversionStore.getState()
        if (state.coverFile !== null) {
          addNotice('Cover already set — remove it in the Cover image section first.')
        } else {
          coverSetThisDrop = pickBestCoverImage(imageFiles)
          setCoverFileDrop(coverSetThisDrop)
          if (imageFiles.length > 1) {
            const rest = imageFiles.length - 1
            addNotice(`Used "${coverSetThisDrop.name}" as cover. ${rest} other image${rest > 1 ? 's' : ''} ignored.`)
          }
        }
      }

      // Audio file routing
      if (audioFiles.length > 0) {
        const { valid, rejected } = validateFiles(audioFiles)
        const skipped = rejected.length + unknownCount
        if (skipped > 0) {
          addNotice(`${skipped} file${skipped === 1 ? '' : 's'} skipped (unsupported format).`)
        }

        if (valid.length > 0) {
          const wasEmpty = useConversionStore.getState().files.length === 0
          const extractions = await Promise.all(valid.map((f) => extractMetadata(f)))

          const existing = useConversionStore.getState().files
          const pool: MatchableFile[] = existing.map((f) => ({
            id: f.id,
            size: f.file.size,
            durationMs: fileSecondsToMs(f.duration),
          }))

          const newFiles: AudioFile[] = []
          const duplicateNames: string[] = []
          const matchedExistingIds: string[] = []
          let firstAcceptedExtraction: ExtractedMetadata | null = null

          for (let i = 0; i < valid.length; i++) {
            const file = valid[i]
            const extracted = extractions[i]
            const candidate = {
              size: file.size,
              durationMs: extracted.durationMs ?? null,
              name: file.name,
            }
            const matchId = findDuplicate(candidate, pool)
            if (matchId !== null) {
              duplicateNames.push(file.name)
              matchedExistingIds.push(matchId)
              continue
            }

            const initialChapterTitle = extracted.chapterTitle || fileNameToChapterTitle(file.name)
            const newFile: AudioFile = {
              id: crypto.randomUUID(),
              file,
              chapterTitle: initialChapterTitle,
              originalChapterTitle: initialChapterTitle,
              duration: extracted.durationMs != null ? extracted.durationMs / 1000 : null,
              embeddedAlbum: extracted.title,
              sourceBitrateKbps: extracted.sourceBitrateKbps,
              sourceLossless: extracted.sourceLossless,
            }
            newFiles.push(newFile)
            pool.push({ id: newFile.id, size: file.size, durationMs: candidate.durationMs })
            if (!firstAcceptedExtraction) firstAcceptedExtraction = extracted
          }

          if (newFiles.length > 0) addFiles(newFiles)
          if (wasEmpty && firstAcceptedExtraction) applyAutoMetadata(firstAcceptedExtraction)
          if (newFiles.length > 0) applySmartBitrate()

          if (duplicateNames.length > 0) {
            setDuplicateNotice({ fileNames: duplicateNames })
            flashFiles(matchedExistingIds)
          }

          if (folderNameRef.current) {
            const coverPart = coverSetThisDrop ? ' and a cover image' : ''
            addNotice(
              `Added ${newFiles.length} audio file${newFiles.length !== 1 ? 's' : ''}${coverPart} from "${folderNameRef.current}".`
            )
          }
        }
      } else if (unknownCount > 0 && !folderNameRef.current) {
        addNotice(`${unknownCount} file${unknownCount === 1 ? '' : 's'} skipped (unsupported format).`)
      }

      folderNameRef.current = null
    },
    [addFiles, applyAutoMetadata, applySmartBitrate, setDuplicateNotice, flashFiles, setCoverFileDrop, addNotice]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  })

  const borderClass = isDragActive
    ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
    : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'

  return (
    <div>
      <div
        {...getRootProps()}
        onDropCapture={captureDropInfo}
        aria-label="Drop audio files and cover image here, or press Enter to browse"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${borderClass}`}
      >
        <input {...getInputProps()} />
        <Upload size={32} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        <p className="mt-3 text-base font-medium text-zinc-800 dark:text-zinc-100">
          {isDragActive ? 'Drop your files here' : 'Drop audio files + cover image, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          MP3 · M4A · WAV · FLAC · OGG · Opus · JPG · PNG
        </p>
      </div>

      {notices.map((n) => (
        <div
          key={n.id}
          role="alert"
          className="mt-2 flex items-center justify-between gap-2 rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          <span>{n.message}</span>
          <button
            type="button"
            onClick={() => dismissNotice(n.id)}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:hover:text-zinc-100"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}

      {isEmpty && (
        <div className="mt-4 rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">New here?</span>{' '}
            M4B is the audiobook format Apple Books, Plex, and most modern players recognise — chapters,
            cover art, and resume position in one tagged file. Drop your audio in and you&apos;ll get
            back a single M4B with chapters at every file boundary.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Bookmark size={14} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              <span>One chapter per file, titled from the filename</span>
            </li>
            <li className="flex items-center gap-2">
              <ImageIcon size={14} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              <span>Optional cover art, embedded at 1200×1200</span>
            </li>
            <li className="flex items-center gap-2">
              <BookOpen size={14} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              <span>
                More detail on the{' '}
                <Link
                  href="/faq"
                  className="text-accent-700 underline hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
                >
                  FAQ page
                </Link>
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
