'use client'

import { orderBy } from 'natural-orderby'
import { create } from 'zustand'
import type {
  AudioFile,
  Bitrate,
  ConversionMetadata,
  ConversionProgress,
  CoverSource,
  DuplicateNotice,
  ExtractedMetadata,
  Genre,
  SortDirection,
} from '@/types'

function sortFilesNatural(files: AudioFile[], direction: 'asc' | 'desc'): AudioFile[] {
  return orderBy(files, [(f) => f.file.name], [direction])
}

let duplicateTimeout: ReturnType<typeof setTimeout> | null = null
let flashTimeout: ReturnType<typeof setTimeout> | null = null

type MetadataField = keyof ConversionMetadata
type TouchedMap = Partial<Record<MetadataField, true>>

interface ConversionStore {
  // Files
  files: AudioFile[]
  addFiles: (files: AudioFile[]) => void
  removeFile: (id: string) => void
  reorderFiles: (activeId: string, overId: string) => void
  sortDirection: SortDirection
  /** Set the sort direction. 'asc' or 'desc' immediately re-sort the list. */
  setSortDirection: (direction: 'asc' | 'desc') => void
  updateChapterTitle: (id: string, title: string) => void

  // Duplicate-detection feedback
  duplicateNotice: DuplicateNotice | null
  setDuplicateNotice: (notice: DuplicateNotice | null) => void
  /** IDs of existing files to briefly highlight (e.g. duplicate matches) */
  flashingIds: ReadonlySet<string>
  flashFiles: (ids: string[]) => void

  // Metadata
  metadata: ConversionMetadata
  /** User-driven metadata edit. Marks fields as touched so auto-fill won't overwrite them. */
  setMetadata: (patch: Partial<ConversionMetadata>) => void
  /** Per-field user-touched flags */
  userTouched: TouchedMap

  // Cover
  coverFile: File | null
  coverSource: CoverSource
  /** User-driven cover upload. Always wins over auto-detected. */
  setCoverFile: (file: File | null) => void

  // Auto-fill from extracted metadata (applies only to untouched fields / non-user cover)
  applyAutoMetadata: (extracted: ExtractedMetadata) => void

  // Bitrate
  bitrate: Bitrate
  setBitrate: (bitrate: Bitrate) => void

  // Conversion state
  progress: ConversionProgress
  setProgress: (progress: ConversionProgress) => void
  outputBlob: Blob | null
  setOutputBlob: (blob: Blob | null) => void

  // Reset
  reset: () => void
}

const defaultMetadata: ConversionMetadata = {
  title: '',
  author: '',
  narrator: '',
  year: String(new Date().getFullYear()),
  genre: 'Audiobook' as Genre,
}

const defaultProgress: ConversionProgress = {
  status: 'idle',
  percent: 0,
  label: '',
}

export const useConversionStore = create<ConversionStore>((set) => ({
  files: [],
  sortDirection: 'asc',
  addFiles: (incoming) =>
    set((state) => {
      const merged = [...state.files, ...incoming]
      // Custom order is sticky: new drops append to the end without re-sorting.
      if (state.sortDirection === 'custom') return { files: merged }
      return { files: sortFilesNatural(merged, state.sortDirection) }
    }),
  removeFile: (id) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== id) })),
  reorderFiles: (activeId, overId) =>
    set((state) => {
      const files = [...state.files]
      const from = files.findIndex((f) => f.id === activeId)
      const to = files.findIndex((f) => f.id === overId)
      if (from === -1 || to === -1) return {}
      const [moved] = files.splice(from, 1)
      files.splice(to, 0, moved)
      return { files, sortDirection: 'custom' }
    }),
  setSortDirection: (direction) =>
    set((state) => ({
      files: sortFilesNatural(state.files, direction),
      sortDirection: direction,
    })),
  updateChapterTitle: (id, title) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, chapterTitle: title } : f)),
    })),

  metadata: defaultMetadata,
  userTouched: {},
  setMetadata: (patch) =>
    set((state) => {
      const touched: TouchedMap = { ...state.userTouched }
      for (const key of Object.keys(patch) as MetadataField[]) {
        touched[key] = true
      }
      return { metadata: { ...state.metadata, ...patch }, userTouched: touched }
    }),

  coverFile: null,
  coverSource: null,
  setCoverFile: (file) => set({ coverFile: file, coverSource: file ? 'user' : null }),

  applyAutoMetadata: (extracted) =>
    set((state) => {
      const patch: Partial<ConversionMetadata> = {}
      const fields: MetadataField[] = ['title', 'author', 'narrator', 'year', 'genre']
      for (const field of fields) {
        if (state.userTouched[field]) continue
        const value = extracted[field as keyof ExtractedMetadata]
        if (value === undefined || value === null || value === '') continue
        patch[field] = value as never
      }

      const next: Partial<ConversionStore> = {}
      if (Object.keys(patch).length > 0) {
        next.metadata = { ...state.metadata, ...patch }
      }
      if (extracted.coverFile && state.coverSource !== 'user') {
        next.coverFile = extracted.coverFile
        next.coverSource = 'auto'
      }
      return next
    }),

  duplicateNotice: null,
  setDuplicateNotice: (notice) => {
    if (duplicateTimeout) {
      clearTimeout(duplicateTimeout)
      duplicateTimeout = null
    }
    set({ duplicateNotice: notice })
    if (notice) {
      duplicateTimeout = setTimeout(() => {
        useConversionStore.setState({ duplicateNotice: null })
        duplicateTimeout = null
      }, 6000)
    }
  },

  flashingIds: new Set<string>(),
  flashFiles: (ids) => {
    if (flashTimeout) clearTimeout(flashTimeout)
    set({ flashingIds: new Set(ids) })
    flashTimeout = setTimeout(() => {
      useConversionStore.setState({ flashingIds: new Set() })
      flashTimeout = null
    }, 1100)
  },

  bitrate: 64,
  setBitrate: (bitrate) => set({ bitrate }),

  progress: defaultProgress,
  setProgress: (progress) => set({ progress }),
  outputBlob: null,
  setOutputBlob: (blob) => set({ outputBlob: blob }),

  reset: () => {
    if (duplicateTimeout) {
      clearTimeout(duplicateTimeout)
      duplicateTimeout = null
    }
    if (flashTimeout) {
      clearTimeout(flashTimeout)
      flashTimeout = null
    }
    set({
      files: [],
      sortDirection: 'asc',
      metadata: defaultMetadata,
      userTouched: {},
      coverFile: null,
      coverSource: null,
      bitrate: 64,
      progress: defaultProgress,
      outputBlob: null,
      duplicateNotice: null,
      flashingIds: new Set(),
    })
  },
}))
