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
