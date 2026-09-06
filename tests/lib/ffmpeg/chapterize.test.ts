import { describe, expect, it } from 'vitest'
import {
  buildChapterizeArgs,
  buildSegmentBoundaries,
  buildSegmentTimes,
  parseSilences,
  proposeChaptersFromSilence,
  proposeEqualChapters,
} from '@/lib/ffmpeg/chapterize'

describe('parseSilences', () => {
  it('pairs silence_start with the following silence_end', () => {
    const out = parseSilences([
      '[silencedetect @ 0x1] silence_start: 60.5',
      '[silencedetect @ 0x1] silence_end: 62.0 | silence_duration: 1.5',
      '[silencedetect @ 0x1] silence_start: 130.25',
      '[silencedetect @ 0x1] silence_end: 131.75 | silence_duration: 1.5',
    ])
    expect(out).toEqual([
      { startMs: 60500, endMs: 62000 },
      { startMs: 130250, endMs: 131750 },
    ])
  })

  it('ignores a trailing start with no matching end', () => {
    const out = parseSilences([
      '[silencedetect] silence_start: 10.0',
      '[silencedetect] silence_end: 11.0 | silence_duration: 1.0',
      '[silencedetect] silence_start: 500.0',
    ])
    expect(out).toEqual([{ startMs: 10000, endMs: 11000 }])
  })

  it('returns nothing when there are no silence lines', () => {
    expect(parseSilences(['frame=  100 fps=50', 'time=00:01:00.00'])).toEqual([])
  })
})

describe('proposeChaptersFromSilence', () => {
  const silences = [
    { startMs: 60000, endMs: 62000 }, // mid 61000
    { startMs: 130000, endMs: 132000 }, // mid 131000
  ]

  it('always starts at 0 and marks the middle of each gap', () => {
    const starts = proposeChaptersFromSilence(silences, 200000, { minChapterMs: 30000 })
    expect(starts).toEqual([0, 61000, 131000])
  })

  it('drops breaks closer than minChapterMs to the previous one', () => {
    // 61000 is < 100000 from 0 → dropped; 131000 is >= 100000 from 0 → kept
    const starts = proposeChaptersFromSilence(silences, 200000, { minChapterMs: 100000 })
    expect(starts).toEqual([0, 131000])
  })

  it('ignores gaps at or past the end of the file', () => {
    const starts = proposeChaptersFromSilence([{ startMs: 199000, endMs: 201000 }], 200000, { minChapterMs: 1000 })
    expect(starts).toEqual([0])
  })
})

describe('proposeEqualChapters', () => {
  it('splits into a fixed number of equal chapters', () => {
    expect(proposeEqualChapters(600000, { count: 4 })).toEqual([0, 150000, 300000, 450000])
  })

  it('splits at a fixed interval', () => {
    expect(proposeEqualChapters(300000, { intervalMs: 120000 })).toEqual([0, 120000, 240000])
  })

  it('never emits a marker at or past the end', () => {
    const starts = proposeEqualChapters(240000, { intervalMs: 120000 })
    expect(starts).toEqual([0, 120000])
    expect(Math.max(...starts)).toBeLessThan(240000)
  })

  it('falls back to a single chapter for unknown duration', () => {
    expect(proposeEqualChapters(0, { count: 5 })).toEqual([0])
  })
})

describe('buildSegmentBoundaries', () => {
  it('keeps the user chapters when none exceed the max segment length', () => {
    const b = buildSegmentBoundaries([0, 600_000, 1_200_000], 1_800_000, 3_600_000)
    expect(b).toEqual([0, 600_000, 1_200_000])
  })

  it('inserts extra splits so no segment exceeds the cap (few chapters)', () => {
    // one chapter over a 50-minute file, 20-minute cap → split at 20 and 40 min
    const b = buildSegmentBoundaries([0], 3_000_000, 1_200_000)
    expect(b).toEqual([0, 1_200_000, 2_400_000])
  })

  it('caps within each user chapter independently', () => {
    const b = buildSegmentBoundaries([0, 3_600_000], 5_400_000, 1_200_000)
    expect(b).toEqual([0, 1_200_000, 2_400_000, 3_600_000, 4_800_000])
  })

  it('always begins at 0 and ignores marks past the end', () => {
    const b = buildSegmentBoundaries([600_000, 9_999_000], 1_000_000, 3_600_000)
    expect(b[0]).toBe(0)
    expect(b).toEqual([0, 600_000])
  })
})

describe('buildSegmentTimes', () => {
  it('joins every boundary after the first as seconds', () => {
    expect(buildSegmentTimes([0, 1_200_000, 2_400_000])).toBe('1200.000,2400.000')
  })
})

describe('buildChapterizeArgs', () => {
  it('re-encodes to AAC with chapters and no cover (metadata index 1)', () => {
    const s = buildChapterizeArgs({ input: 'in.mp3', coverPath: null, metaPath: 'm.txt', bitrate: 64, output: 'out.m4b' }).join(' ')
    expect(s).toContain('-i in.mp3')
    expect(s).toContain('-map 0:a')
    expect(s).not.toContain('mjpeg')
    expect(s).toContain('-map_metadata 1')
    expect(s).toContain('-map_chapters 1')
    expect(s).toContain('-c:a aac')
    expect(s).toContain('-b:a 64k')
    expect(s).toContain('media_type=2')
    expect(s).toContain('+faststart')
  })

  it('embeds a cover as attached_pic at metadata index 2', () => {
    const s = buildChapterizeArgs({ input: 'in.mp3', coverPath: 'c.jpg', metaPath: 'm.txt', bitrate: 96, output: 'out.m4b' }).join(' ')
    expect(s).toContain('-i c.jpg')
    expect(s).toContain('-map 1 -c:v mjpeg -disposition:v attached_pic')
    expect(s).toContain('-map_metadata 2')
    expect(s).toContain('-map_chapters 2')
    expect(s).toContain('-b:a 96k')
  })
})
