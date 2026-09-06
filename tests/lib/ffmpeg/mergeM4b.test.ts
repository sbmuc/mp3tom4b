import { describe, expect, it } from 'vitest'
import {
  analyzeCompatibility,
  buildConcatList,
  buildMergeMetadata,
  buildMergeMuxArgs,
  buildPartCopyArgs,
  buildPartEncodeArgs,
  type MergePart,
} from '@/lib/ffmpeg/mergeM4b'
import type { AudioStreamInfo } from '@/lib/ffmpeg/probeM4b'
import type { ConversionMetadata } from '@/types'

const meta: ConversionMetadata = {
  title: 'My Book',
  author: 'Some Author',
  narrator: 'A Narrator',
  year: '1937',
  genre: 'Audiobook',
}

// Two parts: part 1 (1h) has two chapters, part 2 (30m) has one.
const parts: MergePart[] = [
  {
    durationMs: 3_600_000,
    title: 'Part 1',
    chapters: [
      { title: 'Chapter One', startMs: 0, endMs: 1_800_000 },
      { title: 'Chapter Two', startMs: 1_800_000, endMs: 3_600_000 },
    ],
  },
  {
    durationMs: 1_800_000,
    title: 'Part 2',
    chapters: [{ title: 'Chapter Three', startMs: 0, endMs: 1_800_000 }],
  },
]

describe('buildMergeMetadata', () => {
  it('writes the global tags', () => {
    const out = buildMergeMetadata(meta, parts)
    expect(out.startsWith(';FFMETADATA1\n')).toBe(true)
    expect(out).toContain('title=My Book')
    expect(out).toContain('artist=Some Author')
    expect(out).toContain('album=My Book')
    expect(out).toContain('album_artist=Some Author')
    expect(out).toContain('composer=A Narrator')
    expect(out).toContain('date=1937')
    expect(out).toContain('genre=Audiobook')
  })

  it('offsets later parts onto a continuous timeline', () => {
    const out = buildMergeMetadata(meta, parts)
    // 3 chapters total; the third starts at the end of part 1 (3_600_000ms).
    const starts = Array.from(out.matchAll(/START=(\d+)/g)).map((m) => Number(m[1]))
    expect(starts).toEqual([0, 1_800_000, 3_600_000])
    // Ends are contiguous; final end is the total duration.
    const ends = Array.from(out.matchAll(/END=(\d+)/g)).map((m) => Number(m[1]))
    expect(ends).toEqual([1_800_000, 3_600_000, 5_400_000])
  })

  it('keeps each part chapter title in order', () => {
    const out = buildMergeMetadata(meta, parts)
    const titles = Array.from(out.matchAll(/title=(.+)/g)).map((m) => m[1])
    // first title match is the global title; chapter titles follow
    expect(titles).toContain('Chapter One')
    expect(titles).toContain('Chapter Two')
    expect(titles).toContain('Chapter Three')
  })

  it('makes a chapterless part a single chapter titled by the file', () => {
    const p: MergePart[] = [
      { durationMs: 60_000, title: 'Intro Part', chapters: [] },
      { durationMs: 60_000, title: 'Main Part', chapters: [] },
    ]
    const out = buildMergeMetadata(meta, p)
    const starts = Array.from(out.matchAll(/START=(\d+)/g)).map((m) => Number(m[1]))
    expect(starts).toEqual([0, 60_000])
    expect(out).toContain('title=Intro Part')
    expect(out).toContain('title=Main Part')
  })

  it("perFile mode collapses each part to one chapter", () => {
    const out = buildMergeMetadata(meta, parts, { chapterMode: 'perFile' })
    const starts = Array.from(out.matchAll(/START=(\d+)/g)).map((m) => Number(m[1]))
    expect(starts).toEqual([0, 3_600_000])
    expect(out).toContain('title=Part 1')
    expect(out).toContain('title=Part 2')
  })

  it('escapes metadata and titles', () => {
    const out = buildMergeMetadata(
      { ...meta, title: 'A=B; C#D' },
      [{ durationMs: 1000, title: 'x', chapters: [{ title: 'Odd=Title', startMs: 0, endMs: 1000 }] }],
    )
    expect(out).toContain('title=A\\=B\\; C\\#D')
    expect(out).toContain('title=Odd\\=Title')
  })
})

describe('buildConcatList', () => {
  it('references each intermediate with a trailing newline', () => {
    expect(buildConcatList(['merge_part_000.m4a', 'merge_part_001.m4a'])).toBe(
      "file 'merge_part_000.m4a'\nfile 'merge_part_001.m4a'\n",
    )
  })
})

describe('buildPartCopyArgs / buildPartEncodeArgs', () => {
  it('copies audio only', () => {
    const args = buildPartCopyArgs({ input: 'in.m4b', output: 'p.m4a' })
    expect(args).toContain('-c:a')
    expect(args.join(' ')).toContain('-c:a copy')
    expect(args).toContain('-vn')
    expect(args.join(' ')).not.toContain('aac')
  })

  it('re-encodes to the common AAC target', () => {
    const args = buildPartEncodeArgs({ input: 'in.m4b', output: 'p.m4a', bitrate: 64, target: { sampleRate: 44100, channels: 1 } })
    const s = args.join(' ')
    expect(s).toContain('-c:a aac')
    expect(s).toContain('-b:a 64k')
    expect(s).toContain('-ar 44100')
    expect(s).toContain('-ac 1')
  })
})

describe('buildMergeMuxArgs', () => {
  it('joins with copy and no cover', () => {
    const args = buildMergeMuxArgs({ listPath: 'l.txt', coverPath: null, metaPath: 'm.txt', output: 'out.m4b' })
    const s = args.join(' ')
    expect(s).toContain('-f concat -safe 0 -i l.txt')
    expect(s).toContain('-map 0:a')
    expect(s).not.toContain('mjpeg')
    // metadata is input index 1 when there's no cover
    expect(s).toContain('-map_metadata 1')
    expect(s).toContain('-map_chapters 1')
    expect(s).toContain('-c:a copy')
    expect(s).toContain('media_type=2')
    expect(s).toContain('+faststart')
  })

  it('embeds a cover as attached_pic at metadata index 2', () => {
    const args = buildMergeMuxArgs({ listPath: 'l.txt', coverPath: 'c.jpg', metaPath: 'm.txt', output: 'out.m4b' })
    const s = args.join(' ')
    expect(s).toContain('-i c.jpg')
    expect(s).toContain('-map 1 -c:v mjpeg -disposition:v attached_pic')
    expect(s).toContain('-map_metadata 2')
    expect(s).toContain('-map_chapters 2')
  })
})

describe('analyzeCompatibility', () => {
  const aac = (sampleRate: number, channelLayout: string): AudioStreamInfo => ({ codec: 'aac', sampleRate, channelLayout })

  it('allows copy when all AAC streams match', () => {
    const r = analyzeCompatibility([aac(44100, 'stereo'), aac(44100, 'stereo')])
    expect(r.canCopy).toBe(true)
  })

  it('requires re-encode when sample rates differ', () => {
    const r = analyzeCompatibility([aac(44100, 'stereo'), aac(22050, 'stereo')])
    expect(r.canCopy).toBe(false)
    expect(r.target.sampleRate).toBe(44100) // max
    expect(r.target.channels).toBe(2)
  })

  it('requires re-encode when channels differ, and picks stereo target', () => {
    const r = analyzeCompatibility([aac(44100, 'mono'), aac(44100, 'stereo')])
    expect(r.canCopy).toBe(false)
    expect(r.target.channels).toBe(2)
  })

  it('targets mono only when every input is mono', () => {
    const r = analyzeCompatibility([aac(22050, 'mono'), aac(22050, 'mono')])
    expect(r.canCopy).toBe(true)
    expect(r.target.channels).toBe(1)
  })

  it('requires re-encode for a non-AAC codec', () => {
    const r = analyzeCompatibility([{ codec: 'alac', sampleRate: 44100, channelLayout: 'stereo' }, aac(44100, 'stereo')])
    expect(r.canCopy).toBe(false)
  })
})
