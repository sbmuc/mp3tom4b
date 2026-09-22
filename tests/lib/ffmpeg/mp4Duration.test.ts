import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodedAudioSeconds } from '@/lib/ffmpeg/mp4Duration'

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, '../../fixtures', name)))

// Expected values were measured independently: ffmpeg decoding the fixture
// with `-ignore_editlist 1` (priming + padding included) and counting samples.
describe('decodedAudioSeconds — real ffmpeg-encoded files', () => {
  it('reads packets × 1024 for a plain AAC .m4a (moov at the end)', () => {
    expect(decodedAudioSeconds(fixture('aac-44k-stereo.m4a'))).toBeCloseTo(14336 / 44100, 9)
  })

  it('reads a faststart file (moov before mdat)', () => {
    expect(decodedAudioSeconds(fixture('aac-22k-mono-faststart.m4a'))).toBeCloseTo(11264 / 22050, 9)
  })

  it('reads a file with embedded cover art', () => {
    expect(decodedAudioSeconds(fixture('aac-48k-with-cover.m4a'))).toBeCloseTo(11264 / 48000, 9)
  })

  it('is longer than the source by the priming + padding (why it exists)', () => {
    // 0.3 s source → the edit list hides ~25 ms that concat-copy plays anyway
    const sec = decodedAudioSeconds(fixture('aac-44k-stereo.m4a'))!
    expect(sec - 0.3).toBeGreaterThan(0.02)
  })
})

// --- synthetic boxes -------------------------------------------------------

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const size = 8 + payload.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(size)
  new DataView(out.buffer).setUint32(0, size)
  out.set(new TextEncoder().encode(type), 4)
  let o = 8
  for (const p of payload) {
    out.set(p, o)
    o += p.length
  }
  return out
}
function u32(...values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4)
  values.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v))
  return out
}
const fourcc = (s: string) => new TextEncoder().encode(s)
const hdlr = (handler: string) => box('hdlr', u32(0, 0), fourcc(handler), u32(0, 0, 0))
const mdhdV0 = (timescale: number) => box('mdhd', u32(0, 0, 0, timescale, 0, 0))
const stts = (entries: Array<[number, number]>) => box('stts', u32(0, entries.length, ...entries.flat()))
const trak = (handler: string, timescale: number, entries: Array<[number, number]>) =>
  box('trak', box('mdia', mdhdV0(timescale), hdlr(handler), box('minf', box('stbl', stts(entries)))))

describe('decodedAudioSeconds — box handling', () => {
  it('skips a non-audio trak that comes first (e.g. a chapter text track)', () => {
    const file = box('moov', trak('text', 1000, [[3, 5000]]), trak('soun', 44100, [[100, 1024]]))
    expect(decodedAudioSeconds(file)).toBeCloseTo((100 * 1024) / 44100, 9)
  })

  it('uses the most common delta as the frame size, not the short last packet', () => {
    const file = box('moov', trak('soun', 48000, [[143, 1024], [1, 122]]))
    expect(decodedAudioSeconds(file)).toBeCloseTo((144 * 1024) / 48000, 9)
  })

  it('reads a version-1 mdhd (64-bit times)', () => {
    const mdhdV1 = box('mdhd', new Uint8Array([1, 0, 0, 0]), new Uint8Array(16), u32(22050), new Uint8Array(8), u32(0))
    const file = box('moov', box('trak', box('mdia', mdhdV1, hdlr('soun'), box('minf', box('stbl', stts([[10, 1024]]))))))
    expect(decodedAudioSeconds(file)).toBeCloseTo((10 * 1024) / 22050, 9)
  })

  it('returns null without a moov, without audio, or with an empty sample table', () => {
    expect(decodedAudioSeconds(box('mdat', new Uint8Array(16)))).toBeNull()
    expect(decodedAudioSeconds(box('moov', trak('vide', 90000, [[1, 3000]])))).toBeNull()
    expect(decodedAudioSeconds(box('moov', trak('soun', 44100, [])))).toBeNull()
  })

  it('returns null on garbage and truncated input instead of throwing', () => {
    expect(decodedAudioSeconds(new Uint8Array(0))).toBeNull()
    expect(decodedAudioSeconds(new Uint8Array([0, 0, 0, 99, 0x6d, 0x6f, 0x6f, 0x76]))).toBeNull()
    const whole = fixture('aac-44k-stereo.m4a')
    expect(decodedAudioSeconds(whole.subarray(0, whole.length - 200))).toBeNull()
  })
})
