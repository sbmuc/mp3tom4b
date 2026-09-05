import { describe, expect, it } from 'vitest'
import { buildSplitChapterArgs } from '@/lib/ffmpeg/split'

const base = {
  input: 'in.m4b',
  output: 'seg_0.mp3',
  bitrate: 64 as const,
  meta: { title: 'Introduction', track: '1/12', album: 'My Book', artist: 'Some Author' },
}

describe('buildSplitChapterArgs', () => {
  it('encodes to MP3 (libmp3lame) at the chosen bitrate with the output last', () => {
    const args = buildSplitChapterArgs({ ...base, startSec: 60, durationSec: 120 })
    expect(args.join(' ')).toContain('-c:a libmp3lame')
    expect(args.join(' ')).toContain('-b:a 64k')
    expect(args[args.length - 1]).toBe('seg_0.mp3')
  })

  it('uses input seek + duration for a chapter', () => {
    const args = buildSplitChapterArgs({ ...base, startSec: 60, durationSec: 120 })
    // -ss must come before -i (fast input seek)
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-ss') + 1]).toBe('60')
    expect(args[args.indexOf('-t') + 1]).toBe('120')
  })

  it('omits -ss and -t for a whole-file export', () => {
    const args = buildSplitChapterArgs({ ...base, startSec: 0, durationSec: 0 })
    expect(args).not.toContain('-ss')
    expect(args).not.toContain('-t')
  })

  it('writes per-file title, track, album, and artist tags', () => {
    const joined = buildSplitChapterArgs({ ...base, startSec: 0, durationSec: 100 }).join(' ')
    expect(joined).toContain('-metadata title=Introduction')
    expect(joined).toContain('-metadata track=1/12')
    expect(joined).toContain('-metadata album=My Book')
    expect(joined).toContain('-metadata artist=Some Author')
  })

  it('omits album/artist when not provided', () => {
    const args = buildSplitChapterArgs({
      input: 'in.m4b',
      output: 'seg_0.mp3',
      bitrate: 96,
      startSec: 0,
      durationSec: 100,
      meta: { title: 'Only', track: '1/1' },
    })
    expect(args.join(' ')).not.toContain('album=')
    expect(args.join(' ')).not.toContain('artist=')
    expect(args.join(' ')).toContain('-b:a 96k')
  })
})
