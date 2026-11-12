/** Longest name part we write, in characters. */
export const MAX_NAME_CHARS = 80
/** …and in UTF-8 bytes, so a title in Japanese or emoji stays far from the 255-byte limit. */
const MAX_NAME_BYTES = 160

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length

/**
 * A tag or title made safe as (part of) a file name on Windows, macOS and
 * Linux: characters Windows forbids become "_", control characters go, white
 * space runs become one space, and trailing dots and spaces go (Windows drops
 * them). A long one is cut, at a word break when one is near. Before the cut,
 * a 250-character chapter title gave a ZIP entry that wouldn't unzip: most
 * file systems stop at 255 bytes per name, and Windows at 260 characters for
 * the whole path. No "…" marks the cut: it would make a plain title
 * non-ASCII, and macOS's command-line unzip garbles such names in a ZIP that
 * flags them as UTF-8, as ours does (Finder, Windows and 7-Zip are fine). The
 * full title is still in the file's own tags. Pure.
 */
export function safeFileName(value: string, maxChars = MAX_NAME_CHARS): string {
  const clean = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = Array.from(clean)
  if (chars.length <= maxChars && utf8Bytes(clean) <= MAX_NAME_BYTES) return trimEnd(clean)

  let cut = ''
  let bytes = 0
  for (const ch of chars.slice(0, maxChars)) {
    const b = utf8Bytes(ch)
    if (bytes + b > MAX_NAME_BYTES) break
    cut += ch
    bytes += b
  }
  // Cut at a word when the last space isn't far back; a title without spaces
  // (or in a script without them) is cut where the room runs out.
  const space = cut.lastIndexOf(' ')
  if (space >= cut.length * 0.6) cut = cut.slice(0, space)
  return trimEnd(cut)
}

function trimEnd(s: string): string {
  return s.replace(/[. ]+$/, '')
}
