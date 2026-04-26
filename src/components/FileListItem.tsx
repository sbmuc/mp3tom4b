'use client'

import { GripVertical, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useConversionStore } from '@/lib/store/conversionStore'
import { formatBytes, formatDuration } from '@/lib/audio/format'
import type { AudioFile } from '@/types'

interface Props {
  file: AudioFile
  index: number
}

export default function FileListItem({ file, index }: Props) {
  const updateChapterTitle = useConversionStore((s) => s.updateChapterTitle)
  const removeFile = useConversionStore((s) => s.removeFile)
  const isFlashing = useConversionStore((s) => s.flashingIds.has(file.id))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
        isDragging ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950' : ''
      } ${isFlashing ? 'animate-flash' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${file.chapterTitle}`}
        className="cursor-grab touch-none rounded p-1 text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 active:cursor-grabbing dark:text-zinc-500 dark:hover:text-zinc-200"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>

      <span className="w-6 shrink-0 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {index + 1}.
      </span>

      <input
        type="text"
        value={file.chapterTitle}
        onChange={(e) => updateChapterTitle(file.id, e.target.value)}
        aria-label="Chapter title"
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-900 hover:border-zinc-300 focus:border-accent-500 focus:outline-none dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus:border-accent-400"
      />

      <span className="hidden shrink-0 font-mono text-xs text-zinc-500 sm:inline dark:text-zinc-400">
        {formatBytes(file.file.size)}
      </span>

      <span className="hidden w-14 shrink-0 text-right font-mono text-xs text-zinc-500 sm:inline dark:text-zinc-400">
        {file.duration != null ? formatDuration(file.duration) : '—'}
      </span>

      <button
        type="button"
        onClick={() => removeFile(file.id)}
        aria-label={`Remove ${file.chapterTitle}`}
        className="rounded p-1 text-zinc-400 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-zinc-500 dark:hover:text-rose-400"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  )
}
