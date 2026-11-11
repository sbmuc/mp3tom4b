/**
 * The audio the tools take. The engine (ffmpeg-core) decodes much more than
 * the six formats the site started with, so everything it reads that people
 * actually have is accepted: AAC (ADTS), AIFF, WMA, MP4 (the audio of a
 * video, such as a recorded lecture), Ogg (.oga), WebM/Matroska audio and
 * MPEG layer II. M4B is not here: the converter points those to the M4B tools.
 */
export const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set([
  '.mp3', '.m4a', '.wav', '.flac', '.ogg', '.opus',
  '.aac', '.aif', '.aiff', '.aifc', '.wma', '.mp4', '.oga', '.webm', '.weba', '.mka', '.mp2',
])

/** The formats as the drop zones list them (the common ones; the FAQ has all). */
export const AUDIO_FORMATS_LABEL = 'MP3 · M4A · AAC · WAV · AIFF · FLAC · OGG · Opus · WMA · WebM'

/** The same in a sentence, for messages. */
export const AUDIO_FORMATS_TEXT = 'MP3, M4A, AAC, WAV, AIFF, FLAC, OGG, Opus, WMA, WebM, MKA, MP4 or MP2'

/** For a file input's accept attribute: every audio extension, plus audio/*. */
export const AUDIO_ACCEPT = ['audio/*', ...AUDIO_EXTENSIONS].join(',')

/**
 * Copy-protected audiobooks: Audible's .aa/.aax/.aaxc and iTunes' .m4p. No
 * converter can open them (the audio is encrypted), so they are named as
 * such instead of being called "not audio".
 */
export const DRM_EXTENSIONS: ReadonlySet<string> = new Set(['.aa', '.aax', '.aaxc', '.m4p'])

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
  'audio/aac',
  'audio/x-aac',
  'audio/aiff',
  'audio/x-aiff',
  'audio/x-ms-wma',
  'audio/webm',
  'audio/x-matroska',
])

/** Max total input size before we show a warning (1.5 GB) */
export const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024 * 1024

/** ".mp3" for "Chapter 1.MP3"; "" without an extension. */
export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function isAudioFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true
  return AUDIO_EXTENSIONS.has(extensionOf(file.name))
}

export function isDrmFile(name: string): boolean {
  return DRM_EXTENSIONS.has(extensionOf(name))
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
