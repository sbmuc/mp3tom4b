import { describe, expect, it } from 'vitest'
import {
  buildCompressArgs,
  buildParallelMuxArgs,
  buildSegmentEncodeArgs,
  buildSegmentTimes,
} from '@/lib/ffmpeg/compress'
import type { Chapter } from '@/lib/ffmpeg/splitChapters'

describe('buildCompressArgs', () => {
  it('re-encodes audio to the requested AAC bitrate and preserves chapters + metadata', () => {
    const args = buildCompressArgs({ input: 'in.m4b', output: 'out.m4b', bitrate: 64, hasCover: false })
    expect(args).toContain('-i')
    expect(args).toContain('in.m4b')
    expect(args[args.length - 1]).toBe('out.m4b')
    // audio re-encode
    expect(args.join(' ')).toContain('-c:a aac')
    expect(args.join(' ')).toContain('-b:a 64k')
    // preservation flags
    expect(args.join(' ')).toContain('-map_chapters 0')
    expect(args.join(' ')).toContain('-map_metadata 0')
    expect(args.join(' ')).toContain('-movflags +faststart')
    // audiobook classification (stik=2) so players shelve it correctly
    expect(args.join(' ')).toContain('-metadata media_type=2')
  })

  it('substitutes the chosen bitrate', () => {
    const args = buildCompressArgs({ input: 'in.m4b', output: 'out.m4b', bitrate: 96, hasCover: false })
    expect(args).toContain('-b:a')
    expect(args[args.indexOf('-b:a') + 1]).toBe('96k')
  })

  it('adds the attached_pic disposition only when a cover is present', () => {
    const withCover = buildCompressArgs({ input: 'in.m4b', output: 'out.m4b', bitrate: 64, hasCover: true })
    const withoutCover = buildCompressArgs({ input: 'in.m4b', output: 'out.m4b', bitrate: 64, hasCover: false })
    expect(withCover.join(' ')).toContain('-disposition:v attached_pic')
    expect(withoutCover.join(' ')).not.toContain('-disposition:v attached_pic')
  })

  it('optionally maps the cover stream and always copies (never re-encodes) video', () => {
    const args = buildCompressArgs({ input: 'in.m4b', output: 'out.m4b', bitrate: 64, hasCover: true })
    expect(args.join(' ')).toContain('-map 0:a')
    expect(args.join(' ')).toContain('-map 0:v?')
    expect(args.join(' ')).toContain('-c:v copy')
  })
})

const chaps: Chapter[] = [
  { title: 'One', startMs: 0, endMs: 1800000 },
  { title: 'Two', startMs: 1800000, endMs: 3600000 },
  { title: 'Three', startMs: 3600000, endMs: 5400000 },
]

describe('buildSegmentTimes', () => {
  it('lists the start of every chapter after the first (N-1 boundaries)', () => {
    expect(buildSegmentTimes(chaps)).toBe('1800.000,3600.000')
  })

  it('is empty for a single chapter (no split points)', () => {
    expect(buildSegmentTimes([chaps[0]])).toBe('')
  })
})

describe('buildSegmentEncodeArgs', () => {
  it('re-encodes a segment to AAC at the chosen bitrate', () => {
    const args = buildSegmentEncodeArgs({ input: 'seg_src_000.m4a', output: 'enc_000.m4a', bitrate: 96 })
    expect(args.join(' ')).toContain('-c:a aac')
    expect(args.join(' ')).toContain('-b:a 96k')
    expect(args[args.length - 1]).toBe('enc_000.m4a')
  })
})

describe('buildParallelMuxArgs', () => {
  it('concats segments and pulls chapters + metadata from the ffmetadata input', () => {
    const args = buildParallelMuxArgs({
      listPath: 'list.txt',
      coverPath: null,
      metaPath: 'meta.ffmeta',
      output: 'out.m4b',
    })
    const joined = args.join(' ')
    expect(joined).toContain('-f concat -safe 0 -i list.txt')
    // no cover → ffmetadata is input index 1
    expect(joined).toContain('-map_metadata 1')
    expect(joined).toContain('-map_chapters 1')
    expect(joined).toContain('-c:a copy')
    expect(joined).toContain('-metadata media_type=2')
    expect(joined).not.toContain('mjpeg')
  })

  it('embeds the cover and shifts the metadata input index to 2', () => {
    const args = buildParallelMuxArgs({
      listPath: 'list.txt',
      coverPath: 'cover.jpg',
      metaPath: 'meta.ffmeta',
      output: 'out.m4b',
    })
    const joined = args.join(' ')
    expect(joined).toContain('-i cover.jpg')
    expect(joined).toContain('-map 1 -c:v mjpeg -disposition:v attached_pic')
    expect(joined).toContain('-map_metadata 2')
    expect(joined).toContain('-map_chapters 2')
  })
})
