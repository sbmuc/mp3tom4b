import type { AudioFile, Bitrate, Genre } from '@/types'

export const BITRATE_OPTIONS: readonly Bitrate[] = [64, 96, 128, 192, 256]
export const DEFAULT_BITRATE: Bitrate = 64

/**
 * Pick a sensible default bitrate from the source files and selected genre.
 *
 * Rules (kept deliberately conservative — audiobooks should default to 64):
 * - If any source is lossless OR has a source bitrate above 256 kbps, AND the
 *   genre is not "Audiobook", suggest 96 kbps. Higher-fidelity content paired
 *   with non-spoken-word genres benefits from a small bitrate bump.
 * - Otherwise return the standard 64 kbps default.
 */
export function suggestBitrate(opts: {
  files: Pick<AudioFile, 'sourceBitrateKbps' | 'sourceLossless'>[]
  genre: Genre
}): Bitrate {
  const { files, genre } = opts
  if (files.length === 0) return DEFAULT_BITRATE
  const anyHighFidelity = files.some(
    (f) => f.sourceLossless === true || (f.sourceBitrateKbps ?? 0) > 256
  )
  if (anyHighFidelity && genre !== 'Audiobook') return 96
  return DEFAULT_BITRATE
}

/**
 * Approximate output file size in bytes for the given total duration and
 * AAC bitrate. Container overhead (cover art, chapter atoms, mp4 boxes) is
 * small relative to a multi-hour audio stream, so we don't model it.
 */
export function estimateOutputBytes(totalSeconds: number, bitrateKbps: Bitrate): number {
  if (totalSeconds <= 0) return 0
  return (bitrateKbps * 1000 * totalSeconds) / 8
}

/** Format an estimated byte count for display, e.g. "~340 MB" or "~12 MB". */
export function formatEstimatedSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `~${Math.round(bytes / (1024 * 1024))} MB`
  return `~${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
