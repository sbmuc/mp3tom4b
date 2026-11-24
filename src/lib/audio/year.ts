/**
 * The year or release date every tool writes: four digits (1937), a month
 * (1937-09) or a full date (1937-09-21), or empty. MP4's date tag holds a full
 * date as easily as a year (a book bought from a store carries one), and
 * Mp3tag shows whichever is there. Any year counts: a LibriVox recording of a
 * classic is often tagged with the year the book came out (Moby-Dick, 1851).
 * A month or day has to exist (no 2024-02-30). Pure.
 */
export function isValidYear(value: string): boolean {
  if (value === '') return true
  const m = DATE_RE.exec(value)
  if (!m) return false
  if (m[2] === undefined) return true
  const month = Number(m[2])
  if (month < 1 || month > 12) return false
  if (m[3] === undefined) return true
  const day = Number(m[3])
  const daysInMonth = new Date(Date.UTC(Number(m[1]), month, 0)).getUTCDate()
  return day >= 1 && day <= daysInMonth
}

const DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

/** What every tool says about a year or date that isn't one. */
export const YEAR_PROBLEM = 'Enter a year (1937) or a date (1937-09-21), or leave it empty.'

/**
 * The year or date to show for a file's date tag: the date as far as it is
 * one ("2024-04-03T07:00:00Z", as store-bought books have it, becomes
 * 2024-04-03), else the year. Reading only the year used to turn a full date
 * into a year the next time the file was saved. Pure.
 */
export function yearOrDateFromTags(date: string | undefined, year: number | undefined): string | undefined {
  const m = date?.trim().match(/^\d{4}(?:-\d{2}(?:-\d{2})?)?/)
  if (m && isValidYear(m[0])) return m[0]
  return year ? String(year) : undefined
}
