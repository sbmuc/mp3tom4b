const ACCEPTED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/opus',
])

const ACCEPTED_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus'])

/** Max total input size before we show a warning (1.5 GB) */
export const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024 * 1024

export function isAudioFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ACCEPTED_EXTENSIONS.has(ext)
}

export function validateFiles(files: File[]): { valid: File[]; rejected: File[] } {
  const valid: File[] = []
  const rejected: File[] = []
  for (const file of files) {
    if (isAudioFile(file)) valid.push(file)
    else rejected.push(file)
  }
  return { valid, rejected }
}
