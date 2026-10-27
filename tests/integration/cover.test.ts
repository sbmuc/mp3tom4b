// @vitest-environment node
/**
 * Cover art through the real ffmpeg-core. Its JPEG encoder overran its buffer
 * on many real covers (see src/lib/ffmpeg/cover.ts); the converter showed that
 * as running out of memory, and the compressor never finished.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))
// The browser resizes covers on a canvas; the test cover is already 1200×1200 JPEG.
vi.mock('@/lib/image/resize', () => ({ resizeCoverImage: async (f: File) => f }))

import { compressM4B } from '@/lib/ffmpeg/compress'
import { convertToM4B } from '@/lib/ffmpeg/convert'
import { COVER_CODEC_ARGS } from '@/lib/ffmpeg/cover'
import { META, analyze, asAudioFile, detailedCoverFile, mp3, toneFile } from './helpers'
import { NodeFFmpeg } from './nodeFFmpeg'

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

describe('the cover encoder', () => {
  // Grey noise is a picture the optimal-Huffman encoder reliably can't write.
  const GREY_NOISE = ['-f', 'lavfi', '-i', 'nullsrc=s=600x600,geq=lum=random(1)*255:cb=128:cr=128,format=yuvj420p', '-frames:v', '1']

  it('writes a cover the default JPEG encoder overruns its buffer on', async () => {
    // On an instance of its own: the overrun leaves that instance's memory corrupt.
    const broken = await (await NodeFFmpeg.create()).run([...GREY_NOISE, '-c:v', 'mjpeg', 'broken.jpg'])
    expect(broken.log.join('\n')).toMatch(/put_bits buffer too small/)

    const ff = await NodeFFmpeg.create()
    const fixed = await ff.run([...GREY_NOISE, ...COVER_CODEC_ARGS, '-disposition:v', 'attached_pic', '-f', 'mp4', 'cover.m4b'])
    expect(fixed.ret).toBe(0)
    expect((await ff.run(['-i', 'cover.m4b'])).log.join('\n')).toMatch(/Video: mjpeg.*600x600.*attached pic/)
  })

  it('embeds a cover in a new book, and the compressor keeps it', async () => {
    const coverFile = await detailedCoverFile()
    const files = await Promise.all([mp3(440), mp3(660)].map(async (s, i) => asAudioFile(await toneFile(s), i)))
    const book = await convertToM4B({ files, metadata: META, coverFile, bitrate: 64 })
    const a = await analyze(await bytes(book))
    expect(a.cover).toMatch(/mjpeg.*1200x1200.*attached pic/)
    expect(a.decodeErrors).toEqual([])

    // Two chapters and more than one core: the split-and-join path, whose
    // final join re-encodes the cover.
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    const small = await compressM4B({ file: new File([book], 'book.m4b'), bitrate: 64, hasCover: true })
    const b = await analyze(await bytes(small))
    expect(b.cover).toMatch(/mjpeg.*1200x1200.*attached pic/)
    expect(b.decodeErrors).toEqual([])
    expect(b.chapters).toHaveLength(2)
  })
})
