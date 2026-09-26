import type { AudioFile, Bitrate } from '@/types'

/**
 * How the converter joins its inputs. Every input is encoded to AAC separately
 * (in parallel) and the results are joined with the concat demuxer and `-c copy`.
 * That only works when all parts share one codec config. A part at another
 * sample rate plays at the wrong pitch, and a mono part among stereo ones stops
 * Apple's decoder. Pure + unit-testable.
 */

export interface EncodeTarget {
  sampleRate: number
  channels: 1 | 2
}

// Standard AAC rates. Above 48 kHz buys nothing for speech at these bitrates.
const AAC_SAMPLE_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000]

/**
 * One sample rate + channel count for every encoded part: the highest source
 * rate (snapped up to a standard AAC rate, capped at 48 kHz), mono only when
 * every source is mono. MP4 headers often report mono AAC as 2 channels, so an
 * all-M4A mono set may come out stereo — that costs a little efficiency, never
 * correctness, because every part still gets the same explicit target.
 */
export function pickEncodeTarget(files: Pick<AudioFile, 'sourceSampleRate' | 'sourceChannels'>[]): EncodeTarget {
  const rates = files
    .map((f) => f.sourceSampleRate)
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0)
  const highest = rates.length ? Math.max(...rates) : 44100
  const sampleRate = AAC_SAMPLE_RATES.find((r) => r >= highest) ?? 48000
  const allMono = files.length > 0 && files.every((f) => f.sourceChannels === 1)
  return { sampleRate, channels: allMono ? 1 : 2 }
}

/** ffmpeg args to encode one input to an AAC part at the shared target. */
export function buildEncodeArgs(o: { input: string; output: string; bitrate: Bitrate; target: EncodeTarget }): string[] {
  return [
    '-hide_banner',
    '-i', o.input,
    '-vn',
    '-c:a', 'aac',
    '-b:a', `${o.bitrate}k`,
    '-ar', String(o.target.sampleRate),
    '-ac', String(o.target.channels),
    o.output,
  ]
}

// VBR AAC often reports an average a little above its nominal rate.
const COPY_BITRATE_HEADROOM = 1.15

/**
 * First gate for skipping the re-encode: every input is a lossy AAC .m4a that
 * is already at (or below) the chosen bitrate — so copying honours the choice
 * and the size estimate. The tags can't be trusted for channel layout, so a
 * true answer must still be confirmed with `canCopyStreams` on ffmpeg's probe.
 */
export function mayStreamCopy(
  files: Pick<AudioFile, 'file' | 'sourceCodec' | 'sourceLossless' | 'sourceBitrateKbps'>[],
  bitrate: Bitrate,
): boolean {
  return (
    files.length > 0 &&
    files.every(
      (f) =>
        f.file.name.toLowerCase().endsWith('.m4a') &&
        /aac/i.test(f.sourceCodec ?? '') &&
        f.sourceLossless !== true &&
        f.sourceBitrateKbps != null &&
        f.sourceBitrateKbps <= bitrate * COPY_BITRATE_HEADROOM,
    )
  )
}

const AUDIO_STREAM_RE = /Stream #\d+:\d+.*?:\s*Audio:\s*(.+)$/

/**
 * ffmpeg's description of the first audio stream, trimmed to what a copy-join
 * needs to match: codec + profile, sample rate, channel layout — e.g.
 * "aac (LC) (mp4a / 0x6134706D), 22050 Hz, mono". Sample format and bitrate
 * are dropped; they may differ harmlessly.
 */
export function audioStreamSignature(logLines: string[]): string | null {
  for (const line of logLines) {
    const m = line.match(AUDIO_STREAM_RE)
    if (!m) continue
    return m[1]
      .split(',')
      .slice(0, 3)
      .map((s) => s.trim())
      .join(', ')
  }
  return null
}

/** True when every probed stream is AAC with an identical signature. */
export function canCopyStreams(signatures: Array<string | null>): boolean {
  const first = signatures[0]
  return (
    signatures.length > 0 &&
    first != null &&
    first.startsWith('aac') &&
    signatures.every((s) => s === first)
  )
}

/**
 * Concat demuxer list. `duration` is each part's real decoded length (see
 * mp4Duration.ts); without it the demuxer starts every next part one frame too
 * early, the timestamps overlap and get squashed, and chapter skips drift away
 * from the audio. Parts with an unknown length fall back to the demuxer's own.
 */
export function buildTimedConcatList(parts: Array<{ name: string; durationSec: number | null }>): string {
  return (
    parts
      .map((p) => (p.durationSec != null ? `file '${p.name}'\nduration ${p.durationSec.toFixed(6)}` : `file '${p.name}'`))
      .join('\n') + '\n'
  )
}

/**
 * Actual segment start times (ms) from the segment muxer's CSV list
 * (`-segment_list x.csv -segment_list_type csv`: "name,start,end" per line).
 * A stream-copy split can only cut on a packet, so each piece starts up to one
 * frame away from the time asked for — this is where it really starts. Null
 * when the list doesn't have exactly `count` readable rows.
 */
export function parseSegmentStarts(csv: string, count: number): number[] | null {
  const rows = csv.split('\n').map((l) => l.trim()).filter(Boolean)
  if (rows.length !== count) return null
  const starts = rows.map((row) => Number(row.split(',').at(-2)) * 1000)
  return starts.every((s) => Number.isFinite(s) && s >= 0) ? starts : null
}

/**
 * Where a source time lands once the source was split at `boundariesMs`
 * (segment starts, first is 0), each segment re-encoded, and the results
 * joined with `buildTimedConcatList`: the decoded lengths of the segments
 * before it, plus its offset into its own segment. Re-encoding makes every
 * segment ~20–45 ms longer, so markers kept at their source times would drift
 * further from the audio with every segment.
 */
export function remapThroughSegments(tMs: number, boundariesMs: number[], decodedSec: number[]): number {
  let j = 0
  while (j + 1 < boundariesMs.length && boundariesMs[j + 1] <= tMs) j++
  let before = 0
  for (let k = 0; k < j; k++) before += decodedSec[k] * 1000
  return before + (tMs - boundariesMs[j])
}

/** The decoded lengths when every one is known, else null (keep source timing). */
export function allKnown(decodedSec: Array<number | null>): number[] | null {
  return decodedSec.every((s): s is number => s != null) ? (decodedSec as number[]) : null
}
