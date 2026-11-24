import { describe, expect, it } from 'vitest'
import { discFromTags, discTag } from '@/lib/audio/disc'

describe('discTag', () => {
  it('takes a disc number, or one of a total', () => {
    expect(discTag('2')).toBe('2')
    expect(discTag('1/2')).toBe('1/2')
    expect(discTag(' 2 / 3 ')).toBe('2/3')
    expect(discTag('02')).toBe('2')
  })

  it('is null for what is not one', () => {
    for (const v of ['', '0', '2/', '/3', '3/2', '0/2', 'two', '1234', '1/2/3']) expect(discTag(v)).toBeNull()
  })
})

describe('discFromTags', () => {
  it('shows the number, with the total when there is one', () => {
    expect(discFromTags({ no: 2, of: null })).toBe('2')
    expect(discFromTags({ no: 1, of: 2 })).toBe('1/2')
  })

  it('is empty without a number', () => {
    expect(discFromTags(undefined)).toBeUndefined()
    expect(discFromTags({ no: null, of: null })).toBeUndefined()
    expect(discFromTags({ no: 0, of: 2 })).toBeUndefined()
  })
})
