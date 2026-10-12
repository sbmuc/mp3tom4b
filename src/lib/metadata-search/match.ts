/**
 * How lookup results match what was searched. Pure + unit-testable.
 *
 * Found with a real search (2026-10-12): "Harry Potter and the Half-Blood Prince" with author
 * "Joanne K. Rowling" gave only biographies of her and unrelated books on iTunes, which knows her
 * as "J.K. Rowling"; and since that search found *something*, the title-only search never ran.
 * So people are searched by surname, a search only counts when a result looks like the book,
 * and results are ranked. (The same rules as the iOS app's MetadataSearch.)
 */

/** Words that say little about which book it is. */
const MINOR_WORDS = new Set([
  'a', 'an', 'the', 'and', 'of', 'to', 'in', 'on', 'by', 'for', 'with',
  'de', 'het', 'een', 'en', 'van', 'der', 'die', 'das', 'und', 'le', 'la', 'les', 'et', 'du', 'des',
  'unabridged', 'abridged', 'audiobook', 'edition',
])

/** "Jr." and the like, which come after a surname. */
const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'phd', 'ph.d.'])

/** Separates several people: "A & B", "A; B", "A/B", "A and B" (also Dutch, German, French). */
const SEVERAL = /\s*(?:&|;|\/|\s(?:and|en|und|et)\s)\s*/

/**
 * Anything but a letter or digit, in any script ("日本語" stays one word). Built at run time:
 * the `u` flag can't be written in a literal while TypeScript targets ES5.
 */
const NOT_A_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'u')

/** A title's telling words: lower case, without accents or punctuation. */
export function titleWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(NOT_A_WORD)
    .filter((word) => word && !MINOR_WORDS.has(word))
}

/** How many of `wanted` are in `have`. */
function sharedCount(wanted: Set<string>, have: Set<string>): number {
  return Array.from(wanted).filter((word) => have.has(word)).length
}

function firstPerson(name: string): string {
  const at = name.search(SEVERAL)
  return at >= 0 ? name.slice(0, at) : name
}

/**
 * The part of a name every spelling shares: "Joanne K. Rowling", "J.K. Rowling" and
 * "Rowling, J. K." are all "Rowling". Of several people, the first.
 */
export function surname(name: string): string {
  let rest = firstPerson(name.trim())
  const comma = rest.indexOf(',')
  if (comma >= 0) {
    // "Rowling, J. K.": the surname comes first. "J. K. Rowling, Stephen Fry": two people.
    const before = rest.slice(0, comma).trim()
    const given = rest.slice(comma + 1).trim().split(/\s+/).filter(Boolean)
    if (given.length === 1 || (given.length <= 2 && given.every((g) => g.length <= 3 || g.includes('.')))) {
      return before
    }
    rest = before
  }
  const words = rest.split(/\s+/).filter((word) => word && !SUFFIXES.has(word.toLowerCase()))
  const last = words[words.length - 1]
  if (!last) return rest
  // "J.K.Rowling", written without spaces.
  const parts = last.split('.').filter(Boolean)
  return parts[parts.length - 1] ?? last
}

/** A person's surname and the initials of their other names, lower case, without accents. */
function nameParts(name: string): { surname: string; initials: string[] } {
  const last = titleWords(surname(name)).join('')
  let given = firstPerson(name)
  const comma = given.indexOf(',')
  if (comma >= 0) {
    given = titleWords(given.slice(0, comma)).join('') === last ? given.slice(comma + 1) : given.slice(0, comma)
  }
  const initials = titleWords(given)
    .filter((word) => word !== last && !SUFFIXES.has(word))
    .map((word) => word[0])
  return { surname: last, initials }
}

/**
 * Whether two spellings name the same person: the same surname, and initials that agree as far
 * as both names give them. "Joanne K. Rowling", "J.K. Rowling" and "Rowling, J. K." do; so do
 * "Joanne Rowling" and "J.K. Rowling"; "Jim Dale" and "J.K. Rowling" don't.
 */
export function samePerson(a: string, b: string): boolean {
  const first = nameParts(a)
  const second = nameParts(b)
  if (!first.surname || first.surname !== second.surname) return false
  const shared = Math.min(first.initials.length, second.initials.length)
  for (let i = 0; i < shared; i++) {
    if (first.initials[i] !== second.initials[i]) return false
  }
  return true
}

/** How much of the searched title the found title has: 1 when it has every telling word. */
export function coverage(found: string, searched: string): number {
  const wanted = new Set(titleWords(searched))
  if (wanted.size === 0) return 0
  return sharedCount(wanted, new Set(titleWords(found))) / wanted.size
}

/**
 * Results look like the book when one has most (60%) of the searched title's words. Without a
 * title, any result counts.
 */
export function looksLikeTheBook(titles: string[], searchedTitle: string): boolean {
  if (titleWords(searchedTitle).length === 0) return titles.length > 0
  return titles.some((title) => coverage(title, searchedTitle) >= 0.6)
}

/**
 * How likely a result is the book: its title has the searched title's words (and little else:
 * a "Book Analysis" of it scores lower), and a searched person is among its authors.
 */
export function relevance(result: { title: string; authors: string[] }, title: string, people: string[]): number {
  let score = 0
  const wanted = new Set(titleWords(title))
  if (wanted.size > 0) {
    const have = new Set(titleWords(result.title))
    const shared = sharedCount(wanted, have)
    score += shared / wanted.size
    score += (0.25 * shared) / Math.max(1, have.size)
  }
  const authors = new Set(result.authors.flatMap(titleWords))
  const surnames = people.map((person) => titleWords(surname(person))).filter((words) => words.length > 0)
  if (surnames.some((words) => words.every((word) => authors.has(word)))) score += 0.5
  return score
}

/**
 * Best first, each result once (by key); results that score the same keep the order they were
 * found in.
 */
export function rankResults<T extends { result: { key: string; title: string; authors: string[] } }>(
  found: T[],
  title: string,
  people: string[],
): T[] {
  const seen = new Set<string>()
  const unique = found.filter((item) => {
    if (seen.has(item.result.key)) return false
    seen.add(item.result.key)
    return true
  })
  return unique
    .map((item, index) => ({ item, index, score: relevance(item.result, title, people) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index))
    .map(({ item }) => item)
}
