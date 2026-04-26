const TARGET_SIZE = 1200
const MAX_BYTES = 200 * 1024

/**
 * Resize a cover image File to a 1200×1200 JPEG Blob.
 * Non-square images are letter/pillarboxed with a white background.
 * Output is clamped to ~200 KB via quality reduction.
 */
export async function resizeCoverImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE
  canvas.height = TARGET_SIZE

  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE)

  // Fit image within square, preserving aspect ratio
  const scale = Math.min(TARGET_SIZE / bitmap.width, TARGET_SIZE / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  const x = (TARGET_SIZE - w) / 2
  const y = (TARGET_SIZE - h) / 2

  ctx.drawImage(bitmap, x, y, w, h)

  // Try decreasing quality until under MAX_BYTES
  for (let quality = 0.92; quality >= 0.5; quality -= 0.1) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        quality
      )
    })
    if (blob.size <= MAX_BYTES || quality <= 0.5) return blob
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      0.5
    )
  })
}
