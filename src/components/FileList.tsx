'use client'

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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ArrowDownAZ, ArrowDownZA } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import { formatBytes } from '@/lib/audio/format'
import FileListItem from './FileListItem'

const SORT_LABEL = {
  asc: 'Sorted A→Z',
  desc: 'Sorted Z→A',
  custom: 'Custom order',
} as const

export default function FileList() {
  const files = useConversionStore((s) => s.files)
  const reorderFiles = useConversionStore((s) => s.reorderFiles)
  const sortDirection = useConversionStore((s) => s.sortDirection)
  const setSortDirection = useConversionStore((s) => s.setSortDirection)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (files.length === 0) return null

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0)
  const showSortControls = files.length >= 2

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      reorderFiles(String(active.id), String(over.id))
    }
  }

  const directionButtonClass = (active: boolean) =>
    `inline-flex items-center justify-center rounded-md border p-1.5 text-zinc-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-zinc-300 ${
      active
        ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-400 dark:bg-accent-950/40 dark:text-accent-300'
        : 'border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800'
    }`

  return (
    <section aria-label="Audio file list" className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-medium">{files.length}</span> file
          {files.length === 1 ? '' : 's'}
          <span className="text-zinc-400 dark:text-zinc-500"> · </span>
          <span className="font-mono text-xs">{formatBytes(totalBytes)}</span>
          {showSortControls && (
            <>
              <span className="text-zinc-400 dark:text-zinc-500"> · </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {SORT_LABEL[sortDirection]}
              </span>
            </>
          )}
        </p>

        {showSortControls && (
          <div className="flex items-center gap-2">
            {sortDirection === 'custom' && (
              <button
                type="button"
                onClick={() => setSortDirection('asc')}
                className="text-xs text-accent-700 underline hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-300"
              >
                Reset to A→Z
              </button>
            )}
            <div className="inline-flex gap-1" role="group" aria-label="Sort order">
              <button
                type="button"
                onClick={() => setSortDirection('asc')}
                aria-label="Sort A to Z"
                aria-pressed={sortDirection === 'asc'}
                className={directionButtonClass(sortDirection === 'asc')}
              >
                <ArrowDownAZ size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setSortDirection('desc')}
                aria-label="Sort Z to A"
                aria-pressed={sortDirection === 'desc'}
                className={directionButtonClass(sortDirection === 'desc')}
              >
                <ArrowDownZA size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {files.map((file, index) => (
              <FileListItem key={file.id} file={file} index={index} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  )
}
