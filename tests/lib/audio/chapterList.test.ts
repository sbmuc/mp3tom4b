import { describe, expect, it } from 'vitest'
import {
  applyTitles,
  formatChapterList,
  formatListTime,
  parseChapterList,
  timedRows,
} from '@/lib/audio/chapterList'

describe('parseChapterList: lists with times', () => {
  it('reads a time in front of each title, in the ways lists write it', () => {
    const list = parseChapterList(
      [
        '0:00:00 Opening Credits',
        '[0:00:32] Chapter 1',
        '(12:05) - Chapter 2',
        '1:02:03.5 Chapter 3',
        '01:30:00,250\tChapter 4',
      ].join('\n'),
    )
    expect(list).toEqual({
      kind: 'timed',
      skipped: 0,
      chapters: [
        { startMs: 0, title: 'Opening Credits' },
        { startMs: 32_000, title: 'Chapter 1' },
        { startMs: 725_000, title: 'Chapter 2' },
        { startMs: 3_723_500, title: 'Chapter 3' },
        { startMs: 5_400_250, title: 'Chapter 4' },
      ],
    })
  })

  it('reads a time after each title, as tables of contents and YouTube descriptions have it', () => {
    const list = parseChapterList('Intro 0:00\nThe Road - 4:31\nHome Again ....... 1:02:03\nThe End (1:30:00)')
    expect(list).toMatchObject({
      kind: 'timed',
      chapters: [
        { startMs: 0, title: 'Intro' },
        { startMs: 271_000, title: 'The Road' },
        { startMs: 3_723_000, title: 'Home Again' },
        { startMs: 5_400_000, title: 'The End' },
      ],
    })
  })

  it("reads m4b-tool's chapters.txt", () => {
    const list = parseChapterList('00:00:00.000 Prologue\n00:10:12.345 Chapter 1\n')
    expect(list).toEqual({
      kind: 'timed',
      skipped: 0,
      chapters: [
        { startMs: 0, title: 'Prologue' },
        { startMs: 612_345, title: 'Chapter 1' },
      ],
    })
  })

  it('reads the Nero / OGM format', () => {
    const list = parseChapterList(
      'CHAPTER01=00:00:00.000\nCHAPTER01NAME=Intro\nCHAPTER02=00:05:00.000\nCHAPTER02NAME=Chapter One\nCHAPTER03=00:09:30.500',
    )
    expect(list).toEqual({
      kind: 'timed',
      skipped: 0,
      chapters: [
        { startMs: 0, title: 'Intro' },
        { startMs: 300_000, title: 'Chapter One' },
        { startMs: 570_500, title: '' },
      ],
    })
  })

  it('skips the lines without a time and counts them', () => {
    const list = parseChapterList('Chapters:\n0:00 Intro\n3:10 Part one\n\n9:59 Part two\nThanks for listening!')
    expect(list).toMatchObject({ kind: 'timed', skipped: 2 })
    if (list.kind === 'timed') expect(list.chapters.map((c) => c.title)).toEqual(['Intro', 'Part one', 'Part two'])
  })

  it('sorts the chapters by time and keeps bullets and quotes out of the titles', () => {
    const list = parseChapterList('- 10:00 "Second"\n* 0:00 First\n• 20:00 – Third')
    expect(list).toMatchObject({
      kind: 'timed',
      chapters: [
        { startMs: 0, title: 'First' },
        { startMs: 600_000, title: 'Second' },
        { startMs: 1_200_000, title: 'Third' },
      ],
    })
  })

  it('gives a line with only a time an empty title', () => {
    expect(parseChapterList('0:00\n5:00')).toEqual({
      kind: 'timed',
      skipped: 0,
      chapters: [
        { startMs: 0, title: '' },
        { startMs: 300_000, title: '' },
      ],
    })
  })
})

describe('parseChapterList: titles only', () => {
  it('takes one title per line', () => {
    expect(parseChapterList('Prologue\n\nThe Shadow of the Past\n  Three is Company  \n')).toEqual({
      kind: 'titles',
      titles: ['Prologue', 'The Shadow of the Past', 'Three is Company'],
    })
  })

  it("drops a table of contents' dot leaders and page numbers", () => {
    expect(parseChapterList('Chapter One ........ 1\nChapter Two …… 23')).toEqual({
      kind: 'titles',
      titles: ['Chapter One', 'Chapter Two'],
    })
  })

  it('keeps numbers that are part of a title, and titles that merely contain a time', () => {
    expect(parseChapterList('1984\n12 Angry Men\nThe 4:50 from Paddington\nMurder on the Links')).toEqual({
      kind: 'titles',
      titles: ['1984', '12 Angry Men', 'The 4:50 from Paddington', 'Murder on the Links'],
    })
  })

  it('is empty for blank text', () => {
    expect(parseChapterList('  \n\n ')).toEqual({ kind: 'empty' })
  })
})

describe('formatChapterList', () => {
  it('writes a time and a title per line when every start is known', () => {
    const text = formatChapterList([
      { startMs: 0, title: 'Intro' },
      { startMs: 3_723_500, title: ' Chapter 1 ' },
    ])
    expect(text).toBe('0:00:00 Intro\n1:02:03.500 Chapter 1')
  })

  it('writes only the titles when a start is unknown', () => {
    expect(formatChapterList([{ startMs: 0, title: 'A' }, { startMs: null, title: 'B' }])).toBe('A\nB')
  })

  it('reads back as the same list', () => {
    const chapters = [
      { startMs: 0, title: 'Opening Credits' },
      { startMs: 61_250, title: 'Chapter 1: A Long-expected Party' },
      { startMs: 4_000_000, title: '12 Angry Men' },
    ]
    expect(parseChapterList(formatChapterList(chapters))).toEqual({ kind: 'timed', skipped: 0, chapters })
  })

  it('formats times with milliseconds only when there are some', () => {
    expect(formatListTime(0)).toBe('0:00:00')
    expect(formatListTime(36_000_000 + 5)).toBe('10:00:00.005')
  })
})

describe('applyTitles', () => {
  it('puts the pasted titles over the chapters in order', () => {
    expect(applyTitles(['Track 1', 'Track 2', 'Track 3'], ['One', 'Two', 'Three'])).toEqual({
      titles: ['One', 'Two', 'Three'],
      leftOver: 0,
      kept: 0,
    })
  })

  it('says how many titles were left over, or how many chapters kept their own', () => {
    expect(applyTitles(['a', 'b'], ['A', 'B', 'C', 'D'])).toEqual({ titles: ['A', 'B'], leftOver: 2, kept: 0 })
    expect(applyTitles(['a', 'b', 'c'], ['A'])).toEqual({ titles: ['A', 'b', 'c'], leftOver: 0, kept: 2 })
  })
})

describe('timedRows', () => {
  it('starts at zero, rounds down to the second and names blank chapters', () => {
    const { rows, leftOut } = timedRows(
      [
        { startMs: 1_500, title: 'Intro' },
        { startMs: 61_999, title: '' },
      ],
      120_000,
    )
    expect(rows).toEqual([
      { timeStr: '0:00:00', title: 'Intro' },
      { timeStr: '0:01:01', title: 'Chapter 2' },
    ])
    expect(leftOut).toBe(0)
  })

  it('leaves out chapters past the end, or in the same second as the one before', () => {
    const { rows, leftOut } = timedRows(
      [
        { startMs: 0, title: 'A' },
        { startMs: 10_100, title: 'B' },
        { startMs: 10_900, title: 'B again' },
        { startMs: 200_000, title: 'Past the end' },
      ],
      100_000,
    )
    expect(rows.map((r) => r.title)).toEqual(['A', 'B'])
    expect(leftOut).toBe(2)
  })
})
