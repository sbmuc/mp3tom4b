/**
 * The converter on real MP3 rips: two very different encodings of the same
 * kind of book, one with chapter titles in the tags and one without.
 */
import { describe, expect, it } from 'vitest'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import { BOOKS, FULL, HAVE_FILES, META, asDropped, audioStream, bookInfo, chapterMp3s, expectChaptersMatchSources, realFile } from './files'

const pick = (paths: string[], n: number) => (FULL ? paths : paths.slice(0, n))

describe.skipIf(!HAVE_FILES)('convertToM4B on real MP3 rips', () => {
  it('Goblet of Fire (44.1 kHz stereo): chapter titles from the tags, every chapter on its source', async () => {
    const files = await asDropped(await Promise.all(pick(chapterMp3s(BOOKS.goblet), 4).map(realFile)))
    expect(files.slice(0, 2).map((f) => f.chapterTitle)).toEqual(['The Riddle House', 'The Scar'])

    const out = await convertToM4B({ files, metadata: META, coverFile: null, bitrate: 64 })
    const book = await bookInfo(out)
    expectChaptersMatchSources(book, files)
    expect(await audioStream(out)).toMatch(/^aac \(LC\).*44100 Hz, stereo/)
    expect(book.title).toBe(META.title)
  })

  it('Order of the Phoenix (22 kHz mono, no title tags, track tags out of order): order and titles from the filenames', async () => {
    const files = await asDropped(await Promise.all(pick(chapterMp3s(BOOKS.phoenix), 3).map(realFile)))
    expect(files.map((f) => f.chapterTitle).slice(0, 3)).toEqual(['CH01 DUDLEY DEMENTED', 'CH02 A PECK OF OWLS', 'CH03 THE ADVANCE GUARD'])

    const out = await convertToM4B({ files, metadata: META, coverFile: null, bitrate: 64 })
    expectChaptersMatchSources(await bookInfo(out), files)
    // A mono 22 kHz rip stays mono 22 kHz: no upsampling, no fake stereo.
    expect(await audioStream(out)).toMatch(/22050 Hz, mono/)
  })
})
