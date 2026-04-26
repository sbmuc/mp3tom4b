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

/** Strip file extension and clean up underscores/hyphens → title case */
export function fileNameToChapterTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, '')
  const spaced = withoutExt.replace(/[_-]+/g, ' ').trim()
  return spaced.replace(/\w\S*/g, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}
