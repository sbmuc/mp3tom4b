import { describe, expect, it } from 'vitest'
import { LONG_SINGLE_FILE_SEC, handOffToChapterizer, singleLongFile, takeChapterizerHandoff } from '@/lib/handoff'
import type { AudioFile } from '@/types'

const audio = (seconds: number | null): AudioFile => ({
  id: String(Math.random()),
  file: new File([new Uint8Array(1)], 'book.mp3'),
  chapterTitle: 'Book',
  originalChapterTitle: 'Book',
  duration: seconds,
})

describe('singleLongFile', () => {
  it('picks out one long file', () => {
    const f = audio(LONG_SINGLE_FILE_SEC)
    expect(singleLongFile([f])).toBe(f)
  })

  it('ignores a short file, an unknown length, and more than one file', () => {
    expect(singleLongFile([audio(LONG_SINGLE_FILE_SEC - 1)])).toBeNull()
    expect(singleLongFile([audio(null)])).toBeNull()
    expect(singleLongFile([audio(3600), audio(3600)])).toBeNull()
    expect(singleLongFile([])).toBeNull()
  })
})

describe('handOffToChapterizer', () => {
  it('hands a file over once', () => {
    const file = new File([new Uint8Array(1)], 'book.mp3')
    handOffToChapterizer({ file, cover: null, cue: null, metadata: { title: 'Typed' } })
    expect(takeChapterizerHandoff()).toEqual({ file, cover: null, cue: null, metadata: { title: 'Typed' } })
    expect(takeChapterizerHandoff()).toBeNull()
  })
})
