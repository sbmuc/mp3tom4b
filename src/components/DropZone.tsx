'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { validateFiles } from '@/lib/audio/validate'
import { fileNameToChapterTitle } from '@/lib/audio/format'
import { extractMetadata } from '@/lib/audio/metadata'
import type { AudioFile, ExtractedMetadata } from '@/types'

const ACCEPT = {
  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.m4a'],
  'audio/x-m4a': ['.m4a'],
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/flac': ['.flac'],
  'audio/x-flac': ['.flac'],
  'audio/ogg': ['.ogg'],
  'audio/opus': ['.opus'],
}

interface MatchableFile {
  id: string
  size: number
  durationMs: number | null
}

function fileSecondsToMs(seconds: number | null): number | null {
  return seconds == null ? null : Math.round(seconds * 1000)
}

/**
 * Returns the existing file id that matches `candidate`, or null.
 * Match rule: byte size AND duration in ms must both equal.
 * If either side has no duration, fall back to size-only matching.
 */
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

export default function DropZone() {
  const addFiles = useConversionStore((s) => s.addFiles)
  const applyAutoMetadata = useConversionStore((s) => s.applyAutoMetadata)
  const setDuplicateNotice = useConversionStore((s) => s.setDuplicateNotice)
  const flashFiles = useConversionStore((s) => s.flashFiles)
  const [rejectedCount, setRejectedCount] = useState(0)

  const onDrop = useCallback(
    async (accepted: File[], fileRejections: { file: File }[]) => {
      const { valid, rejected } = validateFiles(accepted)
      setRejectedCount(rejected.length + fileRejections.length)
      if (valid.length === 0) return

      const wasEmpty = useConversionStore.getState().files.length === 0
      const extractions = await Promise.all(valid.map((f) => extractMetadata(f)))

      // Build matchable view of the existing list once.
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

        const newFile: AudioFile = {
          id: crypto.randomUUID(),
          file,
          chapterTitle: extracted.chapterTitle || fileNameToChapterTitle(file.name),
          duration: extracted.durationMs != null ? extracted.durationMs / 1000 : null,
        }
        newFiles.push(newFile)
        // Add to pool so within-batch duplicates are also caught.
        pool.push({ id: newFile.id, size: file.size, durationMs: candidate.durationMs })

        if (!firstAcceptedExtraction) firstAcceptedExtraction = extracted
      }

      if (newFiles.length > 0) addFiles(newFiles)

      if (wasEmpty && firstAcceptedExtraction) {
        applyAutoMetadata(firstAcceptedExtraction)
      }

      if (duplicateNames.length > 0) {
        setDuplicateNotice({ fileNames: duplicateNames })
        flashFiles(matchedExistingIds)
      }
    },
    [addFiles, applyAutoMetadata, setDuplicateNotice, flashFiles]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  })

  const borderClass = isDragReject
    ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'
    : isDragActive
      ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
      : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'

  return (
    <div>
      <div
        {...getRootProps()}
        aria-label="Drop audio files here, or press Enter to browse"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${borderClass}`}
      >
        <input {...getInputProps()} />
        <Upload size={32} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
        <p className="mt-3 text-base font-medium text-zinc-800 dark:text-zinc-100">
          {isDragActive ? 'Drop your files here' : 'Drag audio files here, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          MP3 · M4A · WAV · FLAC · OGG · Opus
        </p>
      </div>
      {rejectedCount > 0 && (
        <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {rejectedCount} file{rejectedCount === 1 ? '' : 's'} skipped (unsupported format)
        </p>
      )}
    </div>
  )
}
