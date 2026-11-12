import { describe, expect, it } from 'vitest'
import { MAX_NAME_CHARS, safeFileName } from '@/lib/format/fileName'

const bytes = (s: string) => new TextEncoder().encode(s).length

describe('safeFileName', () => {
  it('replaces what Windows forbids and tidies white space', () => {
    // A run of them (">?") becomes one "_".
    expect(safeFileName('AC/DC: Live <1979>?')).toBe('AC_DC_ Live _1979_')
    expect(safeFileName('  a \t b\n c  ')).toBe('a b c')
  })

  it('drops control characters and trailing dots and spaces', () => {
    expect(safeFileName('Title\u0007 ...')).toBe('Title')
    expect(safeFileName('Vol. 1.')).toBe('Vol. 1')
  })

  it('keeps a short name as it is', () => {
    expect(safeFileName('Chapter 1 – The Boy Who Lived')).toBe('Chapter 1 – The Boy Who Lived')
  })

  it('cuts a long title at a word break, and keeps a plain title plain ASCII', () => {
    const long = 'In which the narrator, having walked for many days across the moor, '.repeat(4)
    const out = safeFileName(long)
    expect(Array.from(out).length).toBeLessThanOrEqual(MAX_NAME_CHARS)
    expect(long.startsWith(out)).toBe(true)
    expect(long[out.length]).toBe(' ') // cut where a word ends
    expect(out).toMatch(/^[\x20-\x7e]+$/) // macOS's unzip garbles non-ASCII names
  })

  it('cuts a title without spaces where the room runs out', () => {
    expect(safeFileName('x'.repeat(300))).toBe('x'.repeat(MAX_NAME_CHARS))
  })

  it('stays well under 255 bytes for titles in other scripts', () => {
    for (const ch of ['日本語のタイトル', '🎧📚', 'Ωμέγα ']) {
      const out = safeFileName(ch.repeat(60))
      // An entry like "001 - <name>.mp3" still fits in 255 bytes.
      expect(bytes(`001 - ${out}.mp3`)).toBeLessThanOrEqual(255)
      expect(out.length).toBeGreaterThan(0)
    }
  })

  it('never splits an emoji in two', () => {
    const out = safeFileName('🎧'.repeat(100))
    expect(out).toMatch(/^(🎧)+$/u)
  })

  it('takes a larger cap for a name the user typed', () => {
    const typed = 'x'.repeat(120)
    expect(safeFileName(typed, 150)).toBe(typed)
  })
})
