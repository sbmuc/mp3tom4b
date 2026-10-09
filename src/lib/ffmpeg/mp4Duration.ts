/**
 * Exact decoded length of the audio track in an MP4/M4A, read straight from its
 * boxes. Pure — no ffmpeg, no DOM.
 *
 * Why not the container duration: an AAC encoder adds a priming frame at the
 * start and pads the last frame, and the edit list hides both, so the
 * "duration" a player shows is the source length. But when separately encoded
 * files are joined with `-c copy`, every one of those frames is played. Each
 * chapter therefore really lasts `packets × frame duration`, which is ~20–45 ms
 * longer than its source. Using the container duration for the join makes the
 * next file start that much too early; over many chapters the chapter markers
 * drift seconds away from the audio.
 */

import { path, readBoxes } from '@/lib/audio/mp4Boxes'

/**
 * Seconds of audio a decoder will actually output for the first sound track:
 * total packets × the nominal frame duration (the most common `stts` delta).
 * Returns null when the file isn't a readable non-fragmented MP4 with audio.
 */
export function decodedAudioSeconds(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const moov = readBoxes(view, 0, bytes.byteLength).find((b) => b.type === 'moov')
  if (!moov) return null

  for (const trak of readBoxes(view, moov.start, moov.end)) {
    if (trak.type !== 'trak') continue
    const hdlr = path(view, trak, ['mdia', 'hdlr'])
    // hdlr: version/flags (4) + pre_defined (4) + handler_type (4)
    if (!hdlr || hdlr.start + 12 > hdlr.end) continue
    if (view.getUint32(hdlr.start + 8) !== 0x736f756e /* 'soun' */) continue

    const mdhd = path(view, trak, ['mdia', 'mdhd'])
    if (!mdhd) return null
    const version = view.getUint8(mdhd.start)
    const timescale = view.getUint32(mdhd.start + (version === 1 ? 20 : 12))
    if (!timescale) return null

    const stts = path(view, trak, ['mdia', 'minf', 'stbl', 'stts'])
    if (!stts) return null
    const entryCount = view.getUint32(stts.start + 4)
    let packets = 0
    let nominal = 0
    let nominalCount = 0
    for (let i = 0; i < entryCount; i++) {
      const at = stts.start + 8 + i * 8
      if (at + 8 > stts.end) return null
      const count = view.getUint32(at)
      const delta = view.getUint32(at + 4)
      packets += count
      if (count > nominalCount) {
        nominalCount = count
        nominal = delta
      }
    }
    if (packets === 0 || nominal === 0) return null
    return (packets * nominal) / timescale
  }
  return null
}
