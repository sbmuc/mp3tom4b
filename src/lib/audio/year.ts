/**
 * The year tag every tool writes: four digits, or empty. Any year counts: a
 * LibriVox recording of a classic is often tagged with the year the book came
 * out (Moby-Dick, 1851), and the old 1900–2099 range in the converter showed
 * an error for those while still writing them. Pure.
 */
export function isValidYear(value: string): boolean {
  return value === '' || /^\d{4}$/.test(value)
}

/** What every tool says about a year that isn't one. */
export const YEAR_PROBLEM = 'Year must be 4 digits, or left empty.'
