export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'flac' | 'ogg' | 'opus'

export type Genre = 'Audiobook' | 'Podcast' | 'Lecture' | 'Other'

export type Bitrate = 64 | 96 | 128

export interface AudioFile {
  id: string
  file: File
  chapterTitle: string
  /** Duration in seconds — populated after probing */
  duration: number | null
}

export interface ConversionMetadata {
  title: string
  author: string
  narrator: string
  year: string
  genre: Genre
}

export type ConversionStatus =
  | 'idle'
  | 'loading-ffmpeg'
  | 'probing'
  | 'encoding'
  | 'concatenating'
  | 'muxing'
  | 'done'
  | 'error'

export interface ExtractedMetadata {
  title?: string
  author?: string
  narrator?: string
  year?: string
  genre?: Genre
  /** Per-file embedded title — used for chapter title when present */
  chapterTitle?: string
  /** Embedded cover art as a File (already wrapped from picture data) */
  coverFile?: File
  /** Duration in milliseconds, parsed from the container's format header */
  durationMs?: number
}

export interface DuplicateNotice {
  fileNames: string[]
}

export type CoverSource = 'user' | 'auto' | null

export type SortDirection = 'asc' | 'desc' | 'custom'

export interface ConversionProgress {
  status: ConversionStatus
  /** 0–100 */
  percent: number
  /** Human-readable step label */
  label: string
}
