/** Format seconds into HH:MM:SS or MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format bytes into human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Turn a filename into a chapter title: drop the extension, turn separators into
 * spaces, collapse whitespace, and capitalize only the first letter.
 *
 * Deliberately NOT Title Case: title-casing every word mangles non-English names
 * (Dutch/German "van der", intentional capitals, ALL-CAPS), wrongly capitalizes
 * after an apostrophe ("'s" → "'S"), and left a triple space where a " - "
 * separator used to be. Sentence case keeps whatever the user typed; the title is
 * click-to-edit anyway.
 */
export function fileNameToChapterTitle(filename: string): string {
  const cleaned = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

const LEADING_NUMBER = /^\s*(\d{1,3})(?:\s*[-–—.:)]\s*|\s+)(\S.*)$/

/**
 * Chapter titles without the track numbers in front ("01 - The Happy Prince",
 * "3. Home Again", "07 Finale"), but only when every title has one, no number
 * repeats, something is left after it, and what's left still tells the
 * chapters apart. A whole set numbered like that is numbering, which players
 * show themselves; a lone "1984" or "12 Angry Men" among plain titles is a
 * name and stays. When the number is all that differs ("01 Book Title",
 * "1 of 3", "1 John"), it stays too. At most three digits, so a year at the
 * start is never taken for a track number.
 */
export function stripTrackNumbers(titles: string[]): string[] {
  if (titles.length < 2) return titles
  const parts = titles.map((t) => LEADING_NUMBER.exec(t))
  if (parts.some((m) => m === null)) return titles
  const numbers = new Set(parts.map((m) => Number(m![1])))
  if (numbers.size !== titles.length) return titles
  const stripped = parts.map((m) => {
    const rest = m![2].trim()
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  })
  if (new Set(stripped.map((t) => t.toLowerCase())).size !== stripped.length) return titles
  return stripped
}
