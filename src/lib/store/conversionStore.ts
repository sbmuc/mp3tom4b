'use client'

import { orderBy } from 'natural-orderby'
import { create } from 'zustand'
import { DEFAULT_BITRATE, suggestBitrate } from '@/lib/audio/bitrate'
import type { CueSheet } from '@/lib/audio/cue'
import { terminateFFmpeg } from '@/lib/ffmpeg/client'
import type {
  AudioFile,
  Bitrate,
  ConversionMetadata,
  ConversionProgress,
  CoverSource,
  DuplicateNotice,
  ExtractedMetadata,
  Genre,
  MetadataSource,
  ShortChapter,
  SortDirection,
} from '@/types'

function sortFilesNatural(files: AudioFile[], direction: 'asc' | 'desc'): AudioFile[] {
  return orderBy(files, [(f) => f.file.name], [direction])
}

/** Same files in the same order. */
function sameOrder(a: AudioFile[], b: AudioFile[]): boolean {
  return a.length === b.length && a.every((f, i) => f.id === b[i].id)
}

/**
 * What an encoded M4B depends on: which files, in which order, at which
 * bitrate. While this stays the same, titles, tags and the cover can be put
 * on the last M4B without encoding again (see LastBuild).
 */
export function buildKey(files: Pick<AudioFile, 'id'>[], bitrate: Bitrate): string {
  return `${files.map((f) => f.id).join('|')}@${bitrate}`
}

/**
 * The last M4B the converter made. Editing a title, a tag or the cover used
 * to throw the result away and start the whole encode again; with this the
 * change goes onto the M4B in a quick remux (no re-encode). It is dropped as
 * soon as the files, their order or the bitrate change, so a big book doesn't
 * stay in memory for an encode that can't use it.
 */
export interface LastBuild {
  blob: Blob
  key: string
  /** Where each chapter starts in that M4B (ms), one per file, and its length. */
  starts: number[]
  durationMs: number
  /** The cover it carries: the exact File, so a new pick is told apart. */
  cover: File | null
}

let duplicateTimeout: ReturnType<typeof setTimeout> | null = null
let flashTimeout: ReturnType<typeof setTimeout> | null = null

type MetadataField = keyof ConversionMetadata
type TouchedMap = Partial<Record<MetadataField, true>>
type VerifiedMap = Partial<Record<MetadataField, MetadataSource>>

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
  /** Per-field flag set when the value came from a verified online source (iTunes / Open Library). */
  verifiedFields: VerifiedMap
  /** Apply user-selected metadata from an external source. Marks each patched field with `source`. */
  applyVerifiedMetadata: (patch: Partial<ConversionMetadata>, source: MetadataSource) => void

  // Cover
  coverFile: File | null
  coverSource: CoverSource
  /** User-driven cover upload. Always wins over auto-detected. */
  setCoverFile: (file: File | null) => void
  /** Cover set automatically by the unified drop zone (image dropped alongside audio). */
  setCoverFileDrop: (file: File) => void

  // Auto-fill from extracted metadata (applies only to untouched fields / non-user cover)
  applyAutoMetadata: (extracted: ExtractedMetadata) => void

  // Bitrate
  bitrate: Bitrate
  /** True once the user has explicitly chosen a bitrate. Smart suggestions only run before this flips. */
  bitrateUserTouched: boolean
  setBitrate: (bitrate: Bitrate) => void
  /** Apply the smart-bitrate rule based on the current files and genre. No-op if user has touched bitrate. */
  applySmartBitrate: () => void

  /** True once the user has clicked Convert at least once. Surfaces form errors
   *  that were hidden until the first submit attempt. Resets with `reset()`. */
  submitAttempted: boolean
  setSubmitAttempted: (v: boolean) => void

  // Conversion state
  progress: ConversionProgress
  setProgress: (progress: ConversionProgress) => void
  outputBlob: Blob | null
  setOutputBlob: (blob: Blob | null) => void
  lastBuild: LastBuild | null
  setLastBuild: (build: LastBuild | null) => void
  /** Chapters that came out much shorter than their files (see convert.ts). */
  shortChapters: ShortChapter[]
  setShortChapters: (short: ShortChapter[]) => void
  /** Cancel a running conversion. Files and metadata are preserved for retry. */
  cancelConversion: () => void

  /** A cue sheet dropped with a single audio file: its chapters, for Add chapters. */
  cue: { file: File; sheet: CueSheet } | null
  setCue: (cue: { file: File; sheet: CueSheet } | null) => void

  // Reset
  reset: () => void
}

const defaultMetadata: ConversionMetadata = {
  title: '',
  author: '',
  narrator: '',
  // Left blank on purpose: auto-filling the current year would stamp e.g. a
  // 1937 book with a 2026 release date. Empty means no `date` atom is written.
  year: '',
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
      if (state.sortDirection === 'custom') return { files: merged, outputBlob: null, lastBuild: null }
      return { files: sortFilesNatural(merged, state.sortDirection), outputBlob: null, lastBuild: null }
    }),
  removeFile: (id) =>
    set((state) => {
      const files = state.files.filter((f) => f.id !== id)
      // A cue sheet belongs to the file it came with; with no files left it goes too.
      return { files, outputBlob: null, lastBuild: null, cue: files.length > 0 ? state.cue : null }
    }),
  reorderFiles: (activeId, overId) =>
    set((state) => {
      const files = [...state.files]
      const from = files.findIndex((f) => f.id === activeId)
      const to = files.findIndex((f) => f.id === overId)
      if (from === -1 || to === -1) return {}
      const [moved] = files.splice(from, 1)
      files.splice(to, 0, moved)
      return { files, sortDirection: 'custom', outputBlob: null, lastBuild: null }
    }),
  setSortDirection: (direction) =>
    set((state) => {
      const files = sortFilesNatural(state.files, direction)
      // A new order is a new book: the M4B made in the old one no longer
      // matches (it used to stay on the page, ready to download).
      if (sameOrder(files, state.files)) return { files, sortDirection: direction }
      return { files, sortDirection: direction, outputBlob: null, lastBuild: null }
    }),
  updateChapterTitle: (id, title) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, chapterTitle: title } : f)),
      outputBlob: null,
    })),

  metadata: defaultMetadata,
  userTouched: {},
  verifiedFields: {},
  setMetadata: (patch) =>
    set((state) => {
      const touched: TouchedMap = { ...state.userTouched }
      const verified: VerifiedMap = { ...state.verifiedFields }
      for (const key of Object.keys(patch) as MetadataField[]) {
        touched[key] = true
        // A user edit clears the "from <source>" badge for that field.
        delete verified[key]
      }
      return {
        metadata: { ...state.metadata, ...patch },
        userTouched: touched,
        verifiedFields: verified,
        outputBlob: null,
      }
    }),
  applyVerifiedMetadata: (patch: Partial<ConversionMetadata>, source: MetadataSource) =>
    set((state) => {
      const verified: VerifiedMap = { ...state.verifiedFields }
      for (const key of Object.keys(patch) as MetadataField[]) {
        verified[key] = source
      }
      return { metadata: { ...state.metadata, ...patch }, verifiedFields: verified, outputBlob: null }
    }),

  coverFile: null,
  coverSource: null,
  setCoverFile: (file) => set({ coverFile: file, coverSource: file ? 'user' : null, outputBlob: null }),
  setCoverFileDrop: (file) => set({ coverFile: file, coverSource: 'drop', outputBlob: null }),

  applyAutoMetadata: (extracted) =>
    set((state) => {
      const patch: Partial<ConversionMetadata> = {}
      const fields: MetadataField[] = ['title', 'author', 'narrator', 'year', 'genre']
      for (const field of fields) {
        if (state.userTouched[field]) continue
        if (state.verifiedFields[field]) continue
        const value = extracted[field as keyof ExtractedMetadata]
        if (value === undefined || value === null || value === '') continue
        patch[field] = value as never
      }

      const next: Partial<ConversionStore> = {}
      if (Object.keys(patch).length > 0) {
        next.metadata = { ...state.metadata, ...patch }
      }
      // A cover the user picked or dropped beats the one embedded in the audio.
      if (extracted.coverFile && (state.coverSource === null || state.coverSource === 'auto')) {
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

  bitrate: DEFAULT_BITRATE,
  bitrateUserTouched: false,
  setBitrate: (bitrate) =>
    set((state) =>
      bitrate === state.bitrate
        ? { bitrateUserTouched: true }
        : { bitrate, bitrateUserTouched: true, outputBlob: null, lastBuild: null },
    ),
  applySmartBitrate: () =>
    set((state) => {
      if (state.bitrateUserTouched) return {}
      const next = suggestBitrate({ files: state.files, genre: state.metadata.genre })
      if (next === state.bitrate) return {}
      return { bitrate: next, outputBlob: null, lastBuild: null }
    }),

  submitAttempted: false,
  setSubmitAttempted: (v) => set({ submitAttempted: v }),

  progress: defaultProgress,
  setProgress: (progress) => set({ progress }),
  outputBlob: null,
  setOutputBlob: (blob) => set({ outputBlob: blob }),
  lastBuild: null,
  setLastBuild: (build) => set({ lastBuild: build }),
  shortChapters: [],
  setShortChapters: (short) => set({ shortChapters: short }),

  cancelConversion: () => {
    terminateFFmpeg()
    set({
      progress: { status: 'idle', percent: 0, label: '' },
    })
  },

  cue: null,
  setCue: (cue) => set({ cue }),

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
      verifiedFields: {},
      coverFile: null,
      coverSource: null,
      bitrate: DEFAULT_BITRATE,
      bitrateUserTouched: false,
      submitAttempted: false,
      progress: defaultProgress,
      outputBlob: null,
      lastBuild: null,
      shortChapters: [],
      duplicateNotice: null,
      flashingIds: new Set(),
      cue: null,
    })
  },
}))
