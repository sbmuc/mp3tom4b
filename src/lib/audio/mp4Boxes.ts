/**
 * Minimal reader for the box (atom) tree of an MP4/M4A/M4B held in memory.
 * Pure — no ffmpeg, no DOM. Truncated or garbage input yields fewer boxes,
 * never a throw.
 */

export interface Box {
  type: string
  start: number // first byte of the payload
  end: number
}

export function readBoxes(view: DataView, start: number, end: number): Box[] {
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

export function child(view: DataView, parent: Box, type: string): Box | null {
  return readBoxes(view, parent.start, parent.end).find((b) => b.type === type) ?? null
}

export function path(view: DataView, from: Box, types: string[]): Box | null {
  let box: Box | null = from
  for (const type of types) {
    if (!box) return null
    box = child(view, box, type)
  }
  return box
}
