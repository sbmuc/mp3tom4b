'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ImageIcon, X } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
}

export default function CoverUpload() {
  const coverFile = useConversionStore((s) => s.coverFile)
  const coverSource = useConversionStore((s) => s.coverSource)
  const setCoverFile = useConversionStore((s) => s.setCoverFile)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) setCoverFile(accepted[0])
    },
    [setCoverFile]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
  })

  const borderClass = isDragReject
    ? 'border-rose-400 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30'
    : isDragActive
      ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
      : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'

  return (
    <section aria-label="Cover image" className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Cover image <span className="text-sm font-normal text-zinc-400">(optional)</span>
      </h2>

      <div className="flex items-start gap-4">
        <div
          {...getRootProps()}
          aria-label="Upload cover image"
          className={`flex h-[200px] w-[200px] shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${borderClass}`}
        >
          <input {...getInputProps()} />
          {previewUrl ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Cover preview"
                className="h-full w-full object-cover"
              />
              {(coverSource === 'auto' || coverSource === 'drop') && (
                <span className="absolute bottom-1 left-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                  {coverSource === 'drop' ? 'from drop · click to replace' : 'from audio file · click to replace'}
                </span>
              )}
            </div>
          ) : (
            <>
              <ImageIcon size={28} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
              <p className="mt-2 px-2 text-xs text-zinc-600 dark:text-zinc-400">
                Drop or click to add cover
              </p>
              <p className="mt-1 font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                JPG · PNG
              </p>
            </>
          )}
        </div>

        <div className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Square images work best. Non-square covers are padded to 1200×1200 with a white
            background and embedded as JPEG.
          </p>
          {coverFile && (
            <button
              type="button"
              onClick={() => setCoverFile(null)}
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <X size={12} aria-hidden="true" />
              Remove cover
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
