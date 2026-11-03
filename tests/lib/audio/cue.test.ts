import { describe, expect, it } from 'vitest'
import { decodeCueBytes, parseCue } from '@/lib/audio/cue'

const EAC = `REM GENRE Audiobook
REM DATE 2019
PERFORMER "Jane Author"
TITLE "The Long Book"
FILE "The Long Book.wav" WAVE
  TRACK 01 AUDIO
    TITLE "Opening Credits"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Chapter One"
    PERFORMER "Narrator"
    INDEX 00 03:12:40
    INDEX 01 03:14:15
  TRACK 03 AUDIO
    TITLE "Chapter Two"
    INDEX 01 642:05:74
`

describe('parseCue', () => {
  it('reads the book title, performer, file and chapters', () => {
    expect(parseCue(EAC)).toEqual({
      title: 'The Long Book',
      performer: 'Jane Author',
      files: ['The Long Book.wav'],
      chapters: [
        { startMs: 0, title: 'Opening Credits' },
        // INDEX 01, not the pregap's INDEX 00; 15 frames = 200 ms
        { startMs: 194_200, title: 'Chapter One' },
        // minutes past 99 on a long book; 74 frames = 987 ms
        { startMs: 38_525_987, title: 'Chapter Two' },
      ],
    })
  })

  it('names untitled tracks, accepts CRLF and unquoted values, and skips tracks without INDEX 01', () => {
    const cue = 'FILE book.mp3 MP3\r\n TRACK 1 AUDIO\r\n  INDEX 01 00:00:00\r\n TRACK 2 AUDIO\r\n  INDEX 00 01:00:00\r\n TRACK 3 AUDIO\r\n  INDEX 01 02:00:00\r\n'
    expect(parseCue(cue)).toEqual({
      files: ['book.mp3'],
      chapters: [
        { startMs: 0, title: 'Track 1' },
        { startMs: 120_000, title: 'Track 3' },
      ],
    })
  })

  it('lists every file of a sheet that spans several', () => {
    const cue = 'FILE "cd1.flac" WAVE\nTRACK 01 AUDIO\nINDEX 01 00:00:00\nFILE "cd2.flac" WAVE\nTRACK 02 AUDIO\nINDEX 01 00:00:00\n'
    expect(parseCue(cue)?.files).toEqual(['cd1.flac', 'cd2.flac'])
  })

  it('returns null for text without tracks', () => {
    expect(parseCue('REM just a comment\n')).toBeNull()
    expect(parseCue('')).toBeNull()
  })
})

describe('decodeCueBytes', () => {
  it('reads UTF-8, with or without a byte-order mark', () => {
    const utf8 = new TextEncoder().encode('TITLE "Café Müller"')
    expect(decodeCueBytes(utf8)).toBe('TITLE "Café Müller"')
    expect(decodeCueBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe('TITLE "Café Müller"')
  })

  it('falls back to Windows-1252 for older rippers', () => {
    // "Café" with é as the single byte 0xE9
    const cp1252 = new Uint8Array([...new TextEncoder().encode('TITLE "Caf'), 0xe9, 0x22])
    expect(decodeCueBytes(cp1252)).toBe('TITLE "Café"')
  })
})
