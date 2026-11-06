import { pickEncodeTarget, type EncodeTarget } from '@/lib/ffmpeg/concatPlan'
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
export function estimateOutputBytes(totalSeconds: number, bitrateKbps: number): number {
  if (totalSeconds <= 0) return 0
  return (bitrateKbps * 1000 * totalSeconds) / 8
}

/**
 * Above this the M4B may not come together in a browser: 2.0 GB has worked
 * (Chrome and Safari), about 3.8 GB failed in Chrome after an hour of encoding,
 * joining the encoded chapters it could no longer hold. Warned about, not
 * blocked: the real limit depends on the browser and the machine.
 */
export const LIKELY_TOO_BIG_BYTES = 2 * 1024 * 1024 * 1024

/** Format an estimated byte count for display, e.g. "~340 MB" or "~12 MB". */
export function formatEstimatedSize(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `~${Math.round(bytes / (1024 * 1024))} MB`
  return `~${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

// The most ffmpeg's AAC encoder puts out per sample rate, in kbps, mono and
// stereo, asked for 320 kbps on pink noise (the hardest case; speech lands
// lower). Its bandwidth depends on the sample rate, so asking for more makes
// no difference: at 22 kHz, 256 kbps comes out at about 110.
const AAC_CEILING_KBPS: Record<number, [mono: number, stereo: number]> = {
  8000: [36, 41],
  11025: [50, 57],
  12000: [54, 62],
  16000: [73, 82],
  22050: [100, 112],
  24000: [109, 122],
  32000: [147, 163],
  44100: [202, 223],
  48000: [220, 243],
}

/** The highest bitrate the encoder reaches at this sample rate and channel count. */
export function aacCeilingKbps(target: EncodeTarget): number {
  const ceiling = AAC_CEILING_KBPS[target.sampleRate] ?? AAC_CEILING_KBPS[48000]
  return ceiling[target.channels === 1 ? 0 : 1]
}

/** The bitrate the M4B really gets: the setting, unless the encoder stops below it. */
export function effectiveKbps(bitrate: Bitrate, target: EncodeTarget): number {
  return Math.min(bitrate, aacCeilingKbps(target))
}

export interface BitrateAdvice {
  /** What stops a higher setting from helping. */
  reason: 'source' | 'sample_rate'
  /** The lowest setting that already keeps everything. */
  enough: Bitrate
  /** reason 'source': the highest bitrate among the files. */
  sourceKbps?: number
  /** reason 'sample_rate': the rate the M4B is made at, and what it tops out at. */
  sampleRate?: number
  ceilingKbps?: number
}

/**
 * When the chosen bitrate is higher than the audio can use, say why: the
 * files are lossy at a lower bitrate (re-encoding can't put back what they
 * don't have), or their sample rate caps the encoder. null when the choice
 * is fine, or when it can't be told (a lossless file, or one without a known
 * bitrate). AAC at the source's bitrate is at least as good as the MP3 was,
 * so the smallest setting at or above it is enough.
 */
export function bitrateAdvice(
  bitrate: Bitrate,
  files: Pick<AudioFile, 'sourceBitrateKbps' | 'sourceLossless' | 'sourceSampleRate' | 'sourceChannels'>[],
): BitrateAdvice | null {
  if (files.length === 0) return null
  const atLeast = (kbps: number): Bitrate => BITRATE_OPTIONS.find((o) => o >= kbps) ?? BITRATE_OPTIONS[BITRATE_OPTIONS.length - 1]

  const target = pickEncodeTarget(files)
  const ceilingKbps = aacCeilingKbps(target)
  const enoughForRate = atLeast(ceilingKbps)

  const lossy = files.every((f) => f.sourceLossless !== true && (f.sourceBitrateKbps ?? 0) > 0)
  if (lossy) {
    const sourceKbps = Math.max(...files.map((f) => f.sourceBitrateKbps ?? 0))
    const enoughForSource = atLeast(sourceKbps)
    if (enoughForSource <= enoughForRate && bitrate > enoughForSource) {
      return { reason: 'source', enough: enoughForSource, sourceKbps }
    }
  }
  if (bitrate > enoughForRate) {
    return { reason: 'sample_rate', enough: enoughForRate, sampleRate: target.sampleRate, ceilingKbps }
  }
  return null
}
