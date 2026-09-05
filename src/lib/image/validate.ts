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
