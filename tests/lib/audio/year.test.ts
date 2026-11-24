import { describe, expect, it } from 'vitest'
import { isValidYear, yearOrDateFromTags } from '@/lib/audio/year'

describe('isValidYear', () => {
  it('takes any four-digit year, old ones included', () => {
    for (const y of ['1851', '1899', '1937', '2026', '2099']) expect(isValidYear(y)).toBe(true)
  })

  it('takes an empty field', () => {
    expect(isValidYear('')).toBe(true)
  })

  it('refuses anything that is not four digits', () => {
    for (const y of ['26', '202', '20266', '2O26', ' 2026', '2026 ', 'abcd']) expect(isValidYear(y)).toBe(false)
  })
})

describe('isValidYear — dates', () => {
  it('takes a release date or a month, as the date tag holds them', () => {
    for (const d of ['1937-09-21', '2024-04-03', '2024-02-29', '1937-09']) expect(isValidYear(d)).toBe(true)
  })

  it('refuses a month or day that does not exist, and other ways of writing a date', () => {
    for (const d of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '2024-04-00', '03-04-2024', '2024/04/03', '2024-4-3', '2024-04-03T10:00'])
      expect(isValidYear(d)).toBe(false)
  })
})

describe('yearOrDateFromTags', () => {
  it('keeps the full date a file has, as far as it is a date', () => {
    expect(yearOrDateFromTags('2024-04-03', 2024)).toBe('2024-04-03')
    expect(yearOrDateFromTags('2024-04-03T07:00:00Z', 2024)).toBe('2024-04-03')
    expect(yearOrDateFromTags('2024-04', 2024)).toBe('2024-04')
  })

  it('falls back to the year for a date it cannot use, and is empty without either', () => {
    expect(yearOrDateFromTags('2024', 2024)).toBe('2024')
    expect(yearOrDateFromTags('2024-13-45', 2024)).toBe('2024')
    expect(yearOrDateFromTags('April 2024', 2024)).toBe('2024')
    expect(yearOrDateFromTags(undefined, 1851)).toBe('1851')
    expect(yearOrDateFromTags(undefined, undefined)).toBeUndefined()
  })
})
