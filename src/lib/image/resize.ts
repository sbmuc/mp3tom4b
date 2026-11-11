/** The longest side an embedded cover gets. */
export const MAX_COVER_SIDE = 1200

/**
 * Above this the JPEG quality steps down. About 60 seconds of a 64 kbps
 * book, so it costs nothing that matters, where the old 200 KB cap pushed a
 * detailed 1200×1200 cover down to quality 0.5.
 */
const MAX_BYTES = 500 * 1024
const QUALITIES = [0.9, 0.85, 0.8, 0.75]

/**
 * The side of the square cover for an image of w×h: its longer side, at most
 * MAX_COVER_SIDE. A smaller image is never enlarged: a 500×500 cover blown up
 * to 1200×1200 is three times the bytes and not one bit sharper. Pure.
 */
export function coverSide(width: number, height: number): number {
  return Math.max(1, Math.min(MAX_COVER_SIDE, Math.round(Math.max(width, height))))
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/jpeg', quality)
  })
}

/**
 * Make the cover to embed: a square JPEG of up to 1200×1200. Non-square
 * images are letter/pillarboxed on white. The result is what goes into the
 * M4B as it is (OWN_COVER_ARGS in cover.ts), so its quality is the cover's.
 */
export async function resizeCoverImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = coverSide(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, side, side)

  // Fit image within square, preserving aspect ratio
  const scale = Math.min(side / bitmap.width, side / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  const x = (side - w) / 2
  const y = (side - h) / 2

  ctx.drawImage(bitmap, x, y, w, h)
  bitmap.close?.()

  // Step the quality down only as far as it takes to fit the budget.
  let blob: Blob | null = null
  for (const quality of QUALITIES) {
    blob = await toJpeg(canvas, quality)
    if (blob.size <= MAX_BYTES) return blob
  }
  return blob!
}
