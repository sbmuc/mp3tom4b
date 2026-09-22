'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { Bookmark, BookOpen, Image as ImageIcon, Upload, X } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { validateFiles } from '@/lib/audio/validate'
import { fileNameToChapterTitle } from '@/lib/audio/format'
import { extractMetadata } from '@/lib/audio/metadata'
import { isDecodableImage } from '@/lib/image/validate'
import { getFFmpeg } from '@/lib/ffmpeg/client'
import { probeDurationViaAudioElement } from '@/lib/ffmpeg/probe'
import type { AudioFile, ExtractedMetadata } from '@/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus'])
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
// Sidecar files common in audiobook folders. Still reported when skipped —
// dropping a folder shouldn't silently swallow things the user can see in it.
const JUNK_EXTENSIONS = new Set(['.txt', '.nfo', '.cue', '.log', '.m3u', '.m3u8', '.sfv', '.pdf', '.xml', '.json'])

/** "a.txt, b.pdf and 2 more" — keeps a long skip list readable. */
function formatNameList(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`
}

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
  name: string
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
    // Require a name match too: two genuinely different files can share an exact
    // byte size and duration (e.g. fixed-length WAV blocks), and deduping those
    // would silently drop chapters. Same name + size + duration is a real dupe.
    if (existing.name !== candidate.name) continue
    if (existing.size !== candidate.size) continue
    if (candidate.durationMs == null || existing.durationMs == null) {
      console.warn(
        `[mp3tom4b] Duplicate check fell back to name+size for "${candidate.name}" — duration data unavailable.`
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

  const addNotice = useCallback((message: string, persist = false) => {
    const id = crypto.randomUUID()
    setNotices((prev) => [...prev, { id, message }])
    // "Skipped" / "couldn't read" notices persist until dismissed so they aren't
    // missed in a large drop; informational ones auto-dismiss after 6s.
    if (!persist) {
      const timer = setTimeout(() => {
        setNotices((prev) => prev.filter((n) => n.id !== id))
        noticeTimersRef.current.delete(id)
      }, 6000)
      noticeTimersRef.current.set(id, timer)
    }
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
      const entry = (items[i] as unknown as { webkitGetAsEntry?: () => FileSystemEntry }).webkitGetAsEntry?.()
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
      // Everything that is neither audio nor a usable image. Reported by name so
      // a folder drop never silently swallows a file the user can see.
      const skippedNonAudio: string[] = []

      for (const file of allFiles) {
        switch (classifyFile(file)) {
          case 'audio': audioFiles.push(file); break
          case 'image': imageFiles.push(file); break
          default: skippedNonAudio.push(file.name)
        }
      }

      // Cover image routing
      let coverSetThisDrop: File | null = null
      if (imageFiles.length > 0) {
        const state = useConversionStore.getState()
        if (state.coverFile !== null) {
          addNotice('Cover already set. Remove it in the Cover image section first.', true)
        } else {
          const best = pickBestCoverImage(imageFiles)
          if (await isDecodableImage(best)) {
            coverSetThisDrop = best
            setCoverFileDrop(best)
            if (imageFiles.length > 1) {
              const rest = imageFiles.length - 1
              addNotice(`Used "${best.name}" as cover. ${rest} other image${rest > 1 ? 's' : ''} ignored.`)
            }
          } else {
            addNotice(`"${best.name}" could not be read as an image and was skipped.`, true)
          }
        }
      }

      // Audio file routing
      if (audioFiles.length > 0) {
        const { valid, rejected } = validateFiles(audioFiles)
        if (rejected.length > 0) {
          addNotice(
            `Skipped ${rejected.length} audio file${rejected.length === 1 ? '' : 's'}: ${formatNameList(rejected.map((f) => f.name))}. Only MP3, M4A, WAV, FLAC, OGG, and Opus are supported.`,
            true,
          )
        }

        if (valid.length > 0) {
          const wasEmpty = useConversionStore.getState().files.length === 0
          const extractions = await Promise.all(valid.map((f) => extractMetadata(f)))

          // Tags don't always carry a duration, so fall back to the browser's own
          // decoder (fast, no ffmpeg). A file neither can read is broken and would
          // only fail mid-conversion — flag it now instead.
          const durationsMs = await Promise.all(
            valid.map(async (f, i) =>
              extractions[i].durationMs ?? (await probeDurationViaAudioElement(f)),
            ),
          )

          const existing = useConversionStore.getState().files
          const pool: MatchableFile[] = existing.map((f) => ({
            id: f.id,
            name: f.file.name,
            size: f.file.size,
            durationMs: fileSecondsToMs(f.duration),
          }))

          const newFiles: AudioFile[] = []
          const duplicateNames: string[] = []
          const matchedExistingIds: string[] = []
          let firstAcceptedExtraction: ExtractedMetadata | null = null

          // An embedded title only works as a chapter name when it's unique
          // across the drop. Many MP3 sets stamp every file with the same
          // album/book title, which would otherwise yield N identical chapters —
          // in that case we fall back to the filename instead.
          const embeddedTitleCounts = new Map<string, number>()
          for (const ex of extractions) {
            const t = ex.chapterTitle?.trim().toLowerCase()
            if (t) embeddedTitleCounts.set(t, (embeddedTitleCounts.get(t) ?? 0) + 1)
          }

          const unreadableNames: string[] = []

          for (let i = 0; i < valid.length; i++) {
            const file = valid[i]
            const extracted = extractions[i]
            const durationMs = durationsMs[i] ?? null
            const candidate = {
              size: file.size,
              durationMs,
              name: file.name,
            }
            const matchId = findDuplicate(candidate, pool)
            if (matchId !== null) {
              duplicateNames.push(file.name)
              matchedExistingIds.push(matchId)
              continue
            }

            const tag = extracted.chapterTitle?.trim()
            const tagIsUnique = !!tag && embeddedTitleCounts.get(tag.toLowerCase()) === 1
            const initialChapterTitle = tagIsUnique ? tag : fileNameToChapterTitle(file.name)
            const newFile: AudioFile = {
              id: crypto.randomUUID(),
              file,
              chapterTitle: initialChapterTitle,
              originalChapterTitle: initialChapterTitle,
              duration: durationMs != null ? durationMs / 1000 : null,
              embeddedAlbum: extracted.title,
              sourceBitrateKbps: extracted.sourceBitrateKbps,
              sourceLossless: extracted.sourceLossless,
              sourceSampleRate: extracted.sourceSampleRate,
              sourceChannels: extracted.sourceChannels,
              sourceCodec: extracted.sourceCodec,
              unreadable: durationMs == null,
            }
            if (durationMs == null) unreadableNames.push(file.name)
            newFiles.push(newFile)
            pool.push({ id: newFile.id, name: file.name, size: file.size, durationMs: candidate.durationMs })
            if (!firstAcceptedExtraction) firstAcceptedExtraction = extracted
          }

          if (newFiles.length > 0) addFiles(newFiles)
          if (wasEmpty && firstAcceptedExtraction) applyAutoMetadata(firstAcceptedExtraction)
          if (newFiles.length > 0) applySmartBitrate()

          if (wasEmpty && newFiles.length > 0) {
            // Warm the ffmpeg core now so its ~31 MB one-time download overlaps
            // with the user filling in metadata, instead of stalling the first
            // click on Convert.
            void getFFmpeg().catch(() => {})
          }

          if (unreadableNames.length > 0) {
            addNotice(
              `Could not read ${unreadableNames.length} file${unreadableNames.length === 1 ? '' : 's'}: ${formatNameList(unreadableNames)}. ${unreadableNames.length === 1 ? 'It is' : 'They are'} marked in the list — remove ${unreadableNames.length === 1 ? 'it' : 'them'} to convert.`,
              true,
            )
          }

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
      }

      // Always report non-audio files that were dropped — including when the drop
      // contained nothing else, which previously did nothing at all.
      if (skippedNonAudio.length > 0) {
        addNotice(
          `Skipped ${skippedNonAudio.length} file${skippedNonAudio.length === 1 ? '' : 's'} that ${skippedNonAudio.length === 1 ? "isn't" : "aren't"} audio: ${formatNameList(skippedNonAudio)}.`,
          true,
        )
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
        id="dropzone"
        role="button"
        onDropCapture={captureDropInfo}
        aria-label="Drop audio files and cover image here, or press Enter to browse"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${borderClass}`}
      >
        {/* accept filters only the click-to-browse dialog; drag-drop still
            delivers everything so the skip/classify notices keep working. */}
        <input
          {...getInputProps()}
          accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg,.opus,image/jpeg,image/png,.jpg,.jpeg,.png"
        />
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
            M4B is the audiobook format Apple Books, Plex, and most modern players recognise: chapters,
            cover art, and resume position in one tagged file. Drop your audio in and you&apos;ll get
            back a single M4B with chapters at every file boundary.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <li className="flex items-center gap-2">
              <Bookmark size={14} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              <span>One chapter per file, titled from the file name or its embedded title</span>
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
