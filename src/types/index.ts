export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'flac' | 'ogg' | 'opus'

export type Genre = 'Audiobook' | 'Podcast' | 'Lecture' | 'Other'

export type Bitrate = 64 | 96 | 128 | 192 | 256

export interface AudioFile {
  id: string
  file: File
  chapterTitle: string
  /** Duration in seconds — populated after probing */
  duration: number | null
  /** Per-file `common.album` tag, captured at drop time. Used for mixed-album detection. */
  embeddedAlbum?: string
  /** Initial chapter title at drop time (filename-derived or embedded). Used as the "reset" target for inline edits. */
  originalChapterTitle: string
  /** Source bitrate in kbps, parsed from container header at drop time. */
  sourceBitrateKbps?: number
  /** Whether the source codec is lossless (FLAC, WAV/PCM, etc.). */
  sourceLossless?: boolean
  /** Source sample rate in Hz, from the container header at drop time. */
  sourceSampleRate?: number
  /** Source channel count at drop time. MP4 headers often report mono AAC as 2, so treat as a hint. */
  sourceChannels?: number
  /** Source codec as music-metadata names it ("MPEG-4/AAC", "ALAC", "MPEG 1 Layer 3", …). */
  sourceCodec?: string
  /**
   * Set when neither the tags nor the browser could decode the file at drop
   * time. Such a file would fail mid-conversion, so the row is flagged and
   * converting is blocked until it's removed.
   */
  unreadable?: boolean
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
  /** Source bitrate in kbps, parsed from the format header */
  sourceBitrateKbps?: number
  /** Whether the source codec is lossless */
  sourceLossless?: boolean
  /** Source sample rate in Hz */
  sourceSampleRate?: number
  /** Source channel count (a hint — see AudioFile.sourceChannels) */
  sourceChannels?: number
  /** Source codec name */
  sourceCodec?: string
}

export interface DuplicateNotice {
  fileNames: string[]
}

export type CoverSource = 'user' | 'auto' | 'drop' | null

/** Where a verified metadata value came from. Used for "from X" badges. */
export type MetadataSource = 'itunes' | 'openlibrary'

export type SortDirection = 'asc' | 'desc' | 'custom'

export interface ConversionProgress {
  status: ConversionStatus
  /** 0–100 */
  percent: number
  /** Human-readable step label */
  label: string
}
