import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { IAudioMetadata } from 'music-metadata'

// Real parser by default; single tests swap in a canned result.
vi.mock('music-metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('music-metadata')>()
  return { ...actual, parseBlob: vi.fn(actual.parseBlob) }
})

import { parseBlob } from 'music-metadata'
import { chapterIndexAt, playbackType, previousChapterStart, readPlaybackInfo } from '@/lib/audio/playback'

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, '../../fixtures', name)))

const CHAPTERS = [
  { title: 'A', startSec: 0 },
  { title: 'B', startSec: 60 },
  { title: 'C', startSec: 120 },
]

describe('chapterIndexAt', () => {
  it('finds the chapter playing at a time', () => {
    expect(chapterIndexAt(CHAPTERS, 0)).toBe(0)
    expect(chapterIndexAt(CHAPTERS, 59.9)).toBe(0)
    expect(chapterIndexAt(CHAPTERS, 60)).toBe(1)
    expect(chapterIndexAt(CHAPTERS, 5000)).toBe(2)
  })

  it('counts a seek that lands just short of a start as that chapter', () => {
    expect(chapterIndexAt(CHAPTERS, 59.97)).toBe(1)
  })

  it('is -1 before the first chapter or without chapters', () => {
    expect(chapterIndexAt([{ title: 'Late', startSec: 10 }], 5)).toBe(-1)
    expect(chapterIndexAt([], 5)).toBe(-1)
  })
})

describe('previousChapterStart', () => {
  it('restarts the current chapter after its first few seconds', () => {
    expect(previousChapterStart(CHAPTERS, 75)).toBe(60)
  })

  it('goes to the previous chapter near the start of one', () => {
    expect(previousChapterStart(CHAPTERS, 61)).toBe(0)
    expect(previousChapterStart(CHAPTERS, 120)).toBe(60)
  })

  it('goes to 0 in the first chapter or without chapters', () => {
    expect(previousChapterStart(CHAPTERS, 1)).toBe(0)
    expect(previousChapterStart([], 42)).toBe(0)
  })
})

describe('playbackType', () => {
  it('gives MP4 files a type Safari plays, whatever the drop reported', () => {
    expect(playbackType(new Blob([], { type: 'audio/x-m4b' }), 'Book.m4b')).toBe('audio/mp4')
    expect(playbackType(new Blob([]), 'Book.M4B')).toBe('audio/mp4')
  })

  it('keeps MP3 as audio/mpeg', () => {
    expect(playbackType(new Blob([]), 'Chapter 1.MP3')).toBe('audio/mpeg')
    expect(playbackType(new Blob([], { type: 'audio/mpeg' }), 'download')).toBe('audio/mpeg')
  })
})

describe('readPlaybackInfo', () => {
  it('reads tags and every chapter from a real M4B', async () => {
    const info = await readPlaybackInfo(new Blob([fixture('aac-3-chapters.m4b')]))
    expect(info.title).toBe('Fixture Book')
    expect(info.author).toBe('Fixture Author')
    expect(info.chapters.map((c) => c.title)).toEqual(['Opening', 'Café — Deux', '日本語の章'])
  })

  it('returns the embedded cover as an image Blob', async () => {
    const info = await readPlaybackInfo(new Blob([fixture('aac-48k-with-cover.m4a')]))
    expect(info.cover?.type).toMatch(/^image\//)
    expect(info.cover?.size).toBeGreaterThan(0)
    expect(info.chapters).toEqual([])
  })

  it('uses ID3 chapters and the album as book title for an MP3', async () => {
    vi.mocked(parseBlob).mockResolvedValueOnce({
      common: { album: ' The Book ', title: 'Track 1', artist: 'Author' },
      format: {
        chapters: [
          { title: ' Intro ', start: 0 },
          { title: 'Part 2', start: 754.2 },
        ],
      },
    } as unknown as IAudioMetadata)
    const info = await readPlaybackInfo(new Blob([new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0])]))
    expect(info.title).toBe('The Book')
    expect(info.author).toBe('Author')
    expect(info.chapters).toEqual([
      { title: 'Intro', startSec: 0 },
      { title: 'Part 2', startSec: 754.2 },
    ])
  })

  it('never rejects on an unreadable file', async () => {
    const info = await readPlaybackInfo(new Blob([new Uint8Array([1, 2, 3])]))
    expect(info).toEqual({ title: undefined, author: undefined, narrator: undefined, cover: undefined, chapters: [] })
  })
})
