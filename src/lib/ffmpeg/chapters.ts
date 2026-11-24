import { discTag } from '@/lib/audio/disc'
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
 * Swap the [CHAPTER] blocks of an ffmetadata dump for `marks`, keeping its
 * global tags exactly as they were. Pure.
 */
export function replaceChapters(ffmetadata: string, marks: ChapterMark[]): string {
  const cut = ffmetadata.search(/^\[CHAPTER\]/m)
  const head = (cut >= 0 ? ffmetadata.slice(0, cut) : ffmetadata).replace(/\s*$/, '\n')
  return head + buildFFMetadata(marks).replace(/^;FFMETADATA1\n/, '')
}

/** Where `ch` first appears in an ffmetadata line, not counting escaped ones; -1 if not. */
function unescapedIndex(line: string, ch: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') i++
    else if (line[i] === ch) return i
  }
  return -1
}

/**
 * The book-level tags of an ffmetadata dump (`ffmpeg -i x -f ffmetadata`),
 * up to its first [CHAPTER] or [STREAM] section, each as its key (lower case)
 * and its line exactly as written: escapes kept, and a value's escaped line
 * breaks part of it, so it can be written back unchanged. Pure.
 */
export function globalTagLines(dump: string): Array<{ key: string; line: string }> {
  const logical: string[] = []
  let current: string | null = null
  for (const physical of dump.replace(/\r\n?/g, '\n').split('\n')) {
    current = current === null ? physical : `${current}\n${physical}`
    // An odd run of backslashes at the end escapes the line break.
    if ((/\\+$/.exec(physical)?.[0].length ?? 0) % 2 === 1) continue
    logical.push(current)
    current = null
  }
  if (current !== null) logical.push(current)

  const tags: Array<{ key: string; line: string }> = []
  for (const line of logical) {
    if (line.startsWith('[')) break
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue
    const eq = unescapedIndex(line, '=')
    if (eq <= 0) continue
    tags.push({ key: line.slice(0, eq).replace(/\\(.)/g, '$1').toLowerCase(), line })
  }
  return tags
}

/**
 * The tags every tool sets from a book's details (buildGlobalMetadata, plus
 * the media type), and the container's own, which the muxer writes itself.
 */
const MANAGED_TAGS = new Set([
  'title', 'artist', 'album', 'album_artist', 'composer', 'date', 'genre',
  'description', 'synopsis', 'show', 'episode_id', 'disc', 'media_type',
  'major_brand', 'minor_version', 'compatible_brands', 'encoder',
])

/**
 * A file's own tags that the book's details don't cover (track, comment,
 * copyright, the sort fields, …), as ffmetadata lines to write back. The
 * editor wrote only the tags it shows, so saving a book tagged in Mp3tag
 * dropped all of these. Pure.
 */
export function otherTagLines(dump: string): string[] {
  return globalTagLines(dump)
    .filter((t) => !MANAGED_TAGS.has(t.key))
    .map((t) => t.line)
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
  // The MP4 muxer writes these as desc and ldes (iTunes' short and long
  // description; Audiobookshelf reads desc), tvsh and tven. tvsh and tven are
  // where Audiobookshelf looks for the series and its number in an M4B
  // ("show" and "episode_id" to ffprobe, server/utils/prober.js); apps that
  // don't use them ignore them. Both descriptions get the whole text.
  const description = metadata.description.replace(/\r\n?/g, '\n').trim()
  if (description) {
    lines.push(`description=${escapeMetadataValue(description)}`)
    lines.push(`synopsis=${escapeMetadataValue(description)}`)
  }
  const series = metadata.series.trim()
  if (series) lines.push(`show=${escapeMetadataValue(series)}`)
  const seriesPart = metadata.seriesPart.trim()
  if (seriesPart) lines.push(`episode_id=${escapeMetadataValue(seriesPart)}`)
  // The MP4 disk atom, Mp3tag's Discnumber. Only a real one ("2", "2/3").
  const disc = discTag(metadata.disc)
  if (disc) lines.push(`disc=${disc}`)
  return lines
}
