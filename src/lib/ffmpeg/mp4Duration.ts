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

interface Box {
  type: string
  start: number // first byte of the payload
  end: number
}

function readBoxes(view: DataView, start: number, end: number): Box[] {
  const boxes: Box[] = []
  let offset = start
  while (offset + 8 <= end) {
    let size = view.getUint32(offset)
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7),
    )
    let header = 8
    if (size === 1) {
      if (offset + 16 > end) break
      size = Number(view.getBigUint64(offset + 8))
      header = 16
    } else if (size === 0) {
      size = end - offset
    }
    if (size < header || offset + size > end) break
    boxes.push({ type, start: offset + header, end: offset + size })
    offset += size
  }
  return boxes
}

function child(view: DataView, parent: Box, type: string): Box | null {
  return readBoxes(view, parent.start, parent.end).find((b) => b.type === type) ?? null
}

function path(view: DataView, from: Box, types: string[]): Box | null {
  let box: Box | null = from
  for (const type of types) {
    if (!box) return null
    box = child(view, box, type)
  }
  return box
}

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
