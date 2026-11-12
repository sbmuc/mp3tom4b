import { describe, expect, it } from 'vitest'
import { isValidYear } from '@/lib/audio/year'

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
