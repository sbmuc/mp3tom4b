/**
 * Image files taken as a cover. Anything the browser can decode works, since
 * the cover is drawn on a canvas and saved as a JPEG; GIF uses its first frame.
 * HEIC/HEIF (iPhone photos) only decode in Safari, so elsewhere they get a
 * message that says so instead of being ignored.
 */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif', '.heic', '.heif',
])

/** For a file input's accept attribute. */
export const IMAGE_ACCEPT = ['image/*', ...IMAGE_EXTENSIONS].join(',')

/** The cover formats as the cover zones list them. */
export const IMAGE_FORMATS_LABEL = 'JPG · PNG · WebP · GIF'

const HEIC = /\.(heic|heif)$/i

export function isImageName(name: string): boolean {
  const i = name.lastIndexOf('.')
  return i >= 0 && IMAGE_EXTENSIONS.has(name.slice(i).toLowerCase())
}

/**
 * Returns true only if the browser can actually decode the image.
 *
 * `<img>` previews are forgiving and will happily show a slightly truncated
 * file, but the conversion step uses `createImageBitmap()`, which is strict and
 * throws on the same file — producing a late failure after the user has already
 * waited for the encode. Validating with the same method up front lets us reject
 * a broken cover the moment it's added.
 */
export async function isDecodableImage(file: File): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

/**
 * Why an image that didn't decode can't be the cover: for HEIC, that this
 * browser can't open the format (only Safari does); else `fallback`.
 */
export function unreadableImageMessage(file: File, fallback: string): string {
  if (HEIC.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    return `"${file.name}" is a HEIC image (the iPhone photo format), which this browser can't open. Save it as a JPG first (on an iPhone: share it to Files, or set Camera › Formats to Most Compatible), or use Safari.`
  }
  return fallback
}

/**
 * Whether a file picked or dropped as the cover can be used, and if not, what
 * to tell the user. Shared by every tool's cover picker.
 */
export async function coverProblem(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/') && !isImageName(file.name)) {
    return `"${file.name}" isn't an image. Pick a JPG, PNG or WebP.`
  }
  if (await isDecodableImage(file)) return null
  return unreadableImageMessage(file, 'That image could not be read. Try a different JPG, PNG or WebP.')
}
