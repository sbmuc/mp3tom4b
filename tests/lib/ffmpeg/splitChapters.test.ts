import { describe, expect, it } from 'vitest'
import { parseChapters } from '@/lib/ffmpeg/splitChapters'

const MS_DUMP = `;FFMETADATA1
title=My Book
artist=Some Author

[CHAPTER]
TIMEBASE=1/1000
START=0
END=1800000
title=Introduction

[CHAPTER]
TIMEBASE=1/1000
START=1800000
END=3600000
title=Chapter One
`

describe('parseChapters', () => {
  it('parses contiguous chapters with millisecond timebase', () => {
    const chapters = parseChapters(MS_DUMP)
    expect(chapters).toEqual([
      { title: 'Introduction', startMs: 0, endMs: 1800000 },
      { title: 'Chapter One', startMs: 1800000, endMs: 3600000 },
    ])
  })

  it('converts a nanosecond timebase to milliseconds', () => {
    const chapters = parseChapters(`;FFMETADATA1
[CHAPTER]
TIMEBASE=1/1000000000
START=0
END=1500000000
title=Nano
`)
    expect(chapters).toEqual([{ title: 'Nano', startMs: 0, endMs: 1500 }])
  })

  it('unescapes ffmetadata-reserved characters in titles', () => {
    const chapters = parseChapters(`;FFMETADATA1
[CHAPTER]
TIMEBASE=1/1000
START=0
END=1000
title=A \\= B\\; \\#1
`)
    expect(chapters[0].title).toBe('A = B; #1')
  })

  it('returns an empty array when there are no chapters', () => {
    expect(parseChapters(';FFMETADATA1\ntitle=No Chapters Here\n')).toEqual([])
    expect(parseChapters('')).toEqual([])
  })

  it('tolerates a missing title', () => {
    const chapters = parseChapters(`;FFMETADATA1
[CHAPTER]
TIMEBASE=1/1000
START=0
END=500
`)
    expect(chapters).toEqual([{ title: '', startMs: 0, endMs: 500 }])
  })
})
