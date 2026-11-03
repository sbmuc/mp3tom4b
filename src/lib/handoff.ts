import type { AudioFile, ConversionMetadata } from '@/types'

/** A single file this long almost certainly wants more than one chapter. */
export const LONG_SINGLE_FILE_SEC = 15 * 60

/** The file, when the converter holds exactly one and it's long; else null. */
export function singleLongFile(files: AudioFile[]): AudioFile | null {
  return files.length === 1 && (files[0].duration ?? 0) >= LONG_SINGLE_FILE_SEC ? files[0] : null
}

export interface ChapterizerHandoff {
  file: File
  /** A cover the user dropped or picked; null to keep the file's own. */
  cover: File | null
  /** A cue sheet dropped with the file; its tracks become the chapters. */
  cue: File | null
  /** Only the fields the user typed or looked up; the rest is re-read from the tags. */
  metadata: Partial<ConversionMetadata>
}

// Module state survives a client-side navigation, so the converter can pass a
// file it already holds to "Add chapters" without the user dropping it again.
// In memory only: a reload or a new tab starts empty, and nothing leaves the page.
let pending: ChapterizerHandoff | null = null

export function handOffToChapterizer(handoff: ChapterizerHandoff): void {
  pending = handoff
}

/** The handed-over file, once; later calls return null. */
export function takeChapterizerHandoff(): ChapterizerHandoff | null {
  const handoff = pending
  pending = null
  return handoff
}

// A finished M4B from another tool's result card ("Edit chapters & tags"),
// for the editor to open as if it had been dropped there. Same rules: memory
// only, taken once.
let pendingEdit: File | null = null

export function handOffToEditor(file: File): void {
  pendingEdit = file
}

export function takeEditorHandoff(): File | null {
  const file = pendingEdit
  pendingEdit = null
  return file
}
