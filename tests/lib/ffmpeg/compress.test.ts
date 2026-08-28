import { describe, expect, it } from 'vitest'
import { buildCompressArgs } from '@/lib/ffmpeg/compress'

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
