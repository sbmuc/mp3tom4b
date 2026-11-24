/**
 * The disc number as the tag gets it: "2", or "2/3" for disc 2 of 3. Mp3tag
 * shows it as Discnumber; some people number the books of a series with it,
 * and a book made in two parts can be disc 1/2 and 2/2. Null when the text
 * isn't one (empty, 0, "3/2", "2/"). Pure.
 */
export function discTag(value: string): string | null {
  const m = /^\s*(\d{1,3})\s*(?:\/\s*(\d{1,3})\s*)?$/.exec(value)
  if (!m) return null
  const no = Number(m[1])
  const of = m[2] === undefined ? null : Number(m[2])
  if (no < 1 || (of !== null && of < no)) return null
  return of === null ? String(no) : `${no}/${of}`
}

/** What the field says while its text can't be saved as a disc number. */
export const DISC_PROBLEM = 'Not saved like this: a number like 2, or 2/3 for disc 2 of 3.'

/** A file's disc number from its tags (music-metadata's `disk`), as the field shows it. Pure. */
export function discFromTags(disk: { no: number | null; of: number | null } | undefined): string | undefined {
  if (!disk?.no || disk.no < 1) return undefined
  return disk.of && disk.of >= disk.no ? `${disk.no}/${disk.of}` : String(disk.no)
}
