/**
 * Changing every chapter title at once: find and replace, removing the text
 * all titles share ("Book Title - " in front of each), and numbering. Pure;
 * each returns the new titles, one per chapter, in the same order.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Separators a replacement can leave at a title's start or end ("- Chapter 1"). Not a full stop: "...And Then". */
const LEFT_EDGE = /^[\s\-–—_|:,]+/
const RIGHT_EDGE = /[\s\-–—_|:,]+$/

/**
 * Replace `find` with `replacement` in every title, as plain text (no
 * patterns), ignoring case unless `matchCase`. A title it changes is tidied:
 * doubled spaces closed up, separators left dangling at either end removed. A
 * title it would leave empty stays as it was.
 */
export function replaceInTitles(titles: string[], find: string, replacement: string, matchCase: boolean): string[] {
  if (find === '') return titles
  return replaceEach(titles, find, replacement, matchCase).map((r, i) => (r === '' ? titles[i] : r))
}

/**
 * How many titles the replacement would leave empty, and so keeps as they
 * were (see replaceInTitles): the reason a title that has the text doesn't
 * change. Pure.
 */
export function titlesLeftEmpty(titles: string[], find: string, replacement: string, matchCase: boolean): number {
  return replaceEach(titles, find, replacement, matchCase).filter((r) => r === '').length
}

/** Each title replaced and tidied; '' where nothing would be left. */
function replaceEach(titles: string[], find: string, replacement: string, matchCase: boolean): string[] {
  if (find === '') return titles
  const pattern = new RegExp(escapeRegExp(find), matchCase ? 'g' : 'gi')
  return titles.map((title) => {
    const replaced = title.replace(pattern, () => replacement)
    if (replaced === title) return title
    return replaced.replace(LEFT_EDGE, '').replace(RIGHT_EDGE, '').replace(/\s{2,}/g, ' ').trim()
  })
}

// What a shared start may end with ("Book - ", "Book: ", "[Book] ") and a
// shared end may start with (" - Book", " (Unabridged)", " [Part 1]").
const PREFIX_SEPARATORS = '-–—_:|.,)]/'
const SUFFIX_SEPARATORS = '-–—_:|,([/'

function commonPrefix(titles: string[]): string {
  let prefix = titles[0]
  for (const t of titles) {
    let i = 0
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++
    prefix = prefix.slice(0, i)
  }
  return prefix
}

function commonSuffix(titles: string[]): string {
  const reversed = commonPrefix(titles.map((t) => [...t].reverse().join('')))
  return [...reversed].reverse().join('')
}

/** The shared start up to and including its last separator and the spaces after it, or ''. */
function prefixToSeparator(prefix: string): string {
  for (let i = prefix.length - 1; i >= 0; i--) {
    if (!PREFIX_SEPARATORS.includes(prefix[i])) continue
    let end = i + 1
    while (end < prefix.length && prefix[end] === ' ') end++
    return prefix.slice(0, end)
  }
  return ''
}

/** The shared end from its first separator and the spaces before it, or ''. */
function suffixFromSeparator(suffix: string): string {
  for (let i = 0; i < suffix.length; i++) {
    if (!SUFFIX_SEPARATORS.includes(suffix[i])) continue
    let start = i
    while (start > 0 && suffix[start - 1] === ' ') start--
    return suffix.slice(start)
  }
  return ''
}

/** Every title still says something, and they still tell the chapters apart. */
function usable(titles: string[]): boolean {
  return titles.every((t) => t !== '') && new Set(titles.map((t) => t.toLowerCase())).size === titles.length
}

export interface SharedText {
  /** Removed from the start of every title ('' for none). */
  prefix: string
  /** Removed from the end of every title ('' for none). */
  suffix: string
  titles: string[]
}

/**
 * The text every title starts or ends with, up to a separator ("Harry Potter
 * 1 - Chapter One" … → "Chapter One" …; "Intro (Unabridged)" … → "Intro" …),
 * and the titles without it. Only at a separator, so "Chapter 1", "Chapter 2"
 * keep their "Chapter". Null when there is nothing to remove, or removing it
 * would leave a title empty or two the same.
 */
export function stripSharedText(titles: string[]): SharedText | null {
  if (titles.length < 2) return null
  const prefix = prefixToSeparator(commonPrefix(titles))
  const suffix = suffixFromSeparator(commonSuffix(titles))
  const cut = (p: string, s: string) =>
    titles.map((t) => t.slice(p.length, t.length - s.length).replace(LEFT_EDGE, '').replace(RIGHT_EDGE, '').trim())
  const tries: Array<[string, string]> = [
    [prefix, suffix],
    [prefix, ''],
    ['', suffix],
  ]
  for (const [p, s] of tries) {
    if (p === '' && s === '') continue
    // A title shorter than both together would be cut twice in the middle.
    if (titles.some((t) => t.length < p.length + s.length)) continue
    const stripped = cut(p, s)
    if (usable(stripped)) return { prefix: p, suffix: s, titles: stripped }
  }
  return null
}

/** "Chapter 1", "Chapter 2", … one per chapter. */
export function numberedTitles(count: number, word = 'Chapter'): string[] {
  return Array.from({ length: count }, (_, i) => `${word} ${i + 1}`)
}
