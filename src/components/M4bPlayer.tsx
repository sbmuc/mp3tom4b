'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useDropzone } from 'react-dropzone'
import { AlertTriangle, Upload } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'

const ACCEPTED_EXTENSIONS = ['.m4b', '.m4a', '.mp4', '.mp3']

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/**
 * Drop an audiobook, play it. The file is handed to the browser's own audio
 * element through a local blob: URL; nothing is uploaded or stored.
 */
export default function M4bPlayer() {
  const [file, setFile] = useState<File | null>(null)
  // Bumped per file so the player starts fresh instead of carrying state over.
  const [fileKey, setFileKey] = useState(0)
  const [inputError, setInputError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const candidate = accepted.find((f) => !f.name.startsWith('.'))
    if (!candidate) return
    if (!hasAcceptedExtension(candidate.name)) {
      setInputError(`"${candidate.name}" isn't an audiobook file this player opens. It plays M4B, M4A, and MP3.`)
      return
    }
    setInputError(null)
    setFile(candidate)
    setFileKey((k) => k + 1)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false })

  return (
    <div className="mx-auto mt-4 max-w-3xl">
      <div
        {...getRootProps()}
        role="button"
        aria-label={
          file
            ? 'Drop another audiobook here to play it instead, or press Enter to browse'
            : 'Drop an M4B, M4A, or MP3 audiobook here, or press Enter to browse'
        }
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
          file ? 'py-5' : 'py-12'
        } ${
          isDragActive
            ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
            : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
        }`}
      >
        <input {...getInputProps()} accept=".m4b,.m4a,.mp4,.mp3,audio/mp4,audio/x-m4a,audio/mpeg" />
        {!file && <Upload size={32} className="mb-3 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />}
        <p className="text-base font-medium text-zinc-800 dark:text-zinc-100">
          {isDragActive
            ? 'Drop your audiobook here'
            : file
              ? 'Drop another file to play it instead'
              : 'Drop an M4B to play it, or click to browse'}
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          M4B · M4A · MP3 · plays from your device, nothing is uploaded
        </p>
      </div>

      {inputError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {inputError} To turn other audio into an M4B, use the{' '}
            <Link href="/" className="underline hover:no-underline">
              converter
            </Link>
            .
          </span>
        </div>
      )}

      {file && (
        <div className="mt-4">
          <AudioPlayer
            key={fileKey}
            file={file}
            fileName={file.name}
            noChaptersHint={
              /\.mp3$/i.test(file.name) ? (
                <>
                  To get chapters, turn it into an M4B with{' '}
                  <Link href="/add-chapters-to-mp3" className="underline hover:no-underline">
                    Add chapters to MP3
                  </Link>
                  .
                </>
              ) : (
                <>
                  You can add them with the{' '}
                  <Link href="/edit-m4b-chapters" className="underline hover:no-underline">
                    chapter editor
                  </Link>
                  .
                </>
              )
            }
          />
        </div>
      )}
    </div>
  )
}
