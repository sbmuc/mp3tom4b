import type { ConversionMetadata } from '@/types'
import type { ChapterMark } from './types'

/**
 * Build chapter marks from per-file durations and titles.
 * Chapters are contiguous: each starts where the previous ended.
 */
export function buildChapters(
  segments: Array<{ title: string; durationMs: number }>
): ChapterMark[] {
  const chapters: ChapterMark[] = []
  let cursor = 0
  for (const seg of segments) {
    const startMs = cursor
    const endMs = cursor + seg.durationMs
    chapters.push({ title: seg.title, startMs, endMs })
    cursor = endMs
  }
  return chapters
}

export function escapeMetadataValue(value: string): string {
  // ffmetadata escapes: =, ;, #, \, and newline must be backslash-escaped.
  return value.replace(/([\\=;#\n])/g, '\\$1')
}

/**
 * Generate an ffmetadata-format chapter file body.
 * See https://ffmpeg.org/ffmpeg-formats.html#Metadata-1
 */
export function buildFFMetadata(chapters: ChapterMark[]): string {
  const lines: string[] = [';FFMETADATA1']
  for (const ch of chapters) {
    lines.push('')
    lines.push('[CHAPTER]')
    lines.push('TIMEBASE=1/1000')
    // Durations measured from the encoded parts are fractional ms.
    lines.push(`START=${Math.round(ch.startMs)}`)
    lines.push(`END=${Math.round(ch.endMs)}`)
    lines.push(`title=${escapeMetadataValue(ch.title)}`)
  }
  return lines.join('\n') + '\n'
}

/**
 * The book-level ffmetadata tags (no `;FFMETADATA1` header), escaped. Shared by
 * the converter, editor and merger so a `\\`, `;` or `=` in a title survives.
 */
export function buildGlobalMetadata(metadata: ConversionMetadata): string[] {
  const lines = [
    `title=${escapeMetadataValue(metadata.title)}`,
    `artist=${escapeMetadataValue(metadata.author)}`,
    `album=${escapeMetadataValue(metadata.title)}`,
    `album_artist=${escapeMetadataValue(metadata.author)}`,
  ]
  if (metadata.narrator) lines.push(`composer=${escapeMetadataValue(metadata.narrator)}`)
  if (metadata.year) lines.push(`date=${escapeMetadataValue(metadata.year)}`)
  lines.push(`genre=${escapeMetadataValue(metadata.genre)}`)
  return lines
}
