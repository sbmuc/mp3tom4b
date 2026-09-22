import { describe, expect, it } from 'vitest'
import {
  audioStreamSignature,
  buildEncodeArgs,
  buildTimedConcatList,
  canCopyStreams,
  mayStreamCopy,
  pickEncodeTarget,
} from '@/lib/ffmpeg/concatPlan'

const file = (name: string) => new File([new Uint8Array(0)], name)

describe('pickEncodeTarget', () => {
  it('keeps a uniform set as it is', () => {
    expect(pickEncodeTarget([
      { sourceSampleRate: 44100, sourceChannels: 2 },
      { sourceSampleRate: 44100, sourceChannels: 2 },
    ])).toEqual({ sampleRate: 44100, channels: 2 })
  })

  it('takes the highest rate and goes stereo when any source is stereo', () => {
    expect(pickEncodeTarget([
      { sourceSampleRate: 22050, sourceChannels: 1 },
      { sourceSampleRate: 48000, sourceChannels: 2 },
    ])).toEqual({ sampleRate: 48000, channels: 2 })
  })

  it('stays mono only when every source is known to be mono', () => {
    expect(pickEncodeTarget([{ sourceChannels: 1 }, { sourceChannels: 1 }]).channels).toBe(1)
    expect(pickEncodeTarget([{ sourceChannels: 1 }, {}]).channels).toBe(2)
  })

  it('caps hi-res sources at 48 kHz and snaps odd rates up to a standard one', () => {
    expect(pickEncodeTarget([{ sourceSampleRate: 96000 }]).sampleRate).toBe(48000)
    expect(pickEncodeTarget([{ sourceSampleRate: 37800 }]).sampleRate).toBe(44100)
  })

  it('falls back to 44.1 kHz stereo when nothing is known', () => {
    expect(pickEncodeTarget([{}, {}])).toEqual({ sampleRate: 44100, channels: 2 })
  })
})

describe('buildEncodeArgs', () => {
  it('pins sample rate and channels on every part', () => {
    const args = buildEncodeArgs({ input: 'in.mp3', output: 'enc_0.m4a', bitrate: 64, target: { sampleRate: 48000, channels: 1 } })
    expect(args).toEqual(['-hide_banner', '-i', 'in.mp3', '-vn', '-c:a', 'aac', '-b:a', '64k', '-ar', '48000', '-ac', '1', 'enc_0.m4a'])
  })
})

describe('mayStreamCopy', () => {
  const aac = (kbps: number, name = 'a.m4a') => ({
    file: file(name), sourceCodec: 'MPEG-4/AAC', sourceLossless: false, sourceBitrateKbps: kbps,
  })

  it('allows AAC .m4a inputs at or below the chosen bitrate (with VBR headroom)', () => {
    expect(mayStreamCopy([aac(64), aac(70)], 64)).toBe(true)
  })

  it('re-encodes when a source is above the chosen bitrate, so the choice is honoured', () => {
    expect(mayStreamCopy([aac(64), aac(256)], 64)).toBe(false)
  })

  it('never copies ALAC, non-m4a, or files with an unknown codec/bitrate', () => {
    expect(mayStreamCopy([{ ...aac(64), sourceCodec: 'ALAC', sourceLossless: true }], 256)).toBe(false)
    expect(mayStreamCopy([aac(64, 'a.mp4'), aac(64)], 64)).toBe(false)
    expect(mayStreamCopy([{ ...aac(64), sourceCodec: undefined }], 64)).toBe(false)
    expect(mayStreamCopy([{ ...aac(64), sourceBitrateKbps: undefined }], 64)).toBe(false)
  })

  it('is false for an empty list', () => {
    expect(mayStreamCopy([], 64)).toBe(false)
  })
})

describe('audioStreamSignature + canCopyStreams', () => {
  const log = (desc: string) => [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'enc_0.m4a':",
    '  Duration: 00:00:01.00, start: 0.000000, bitrate: 68 kb/s',
    `  Stream #0:0[0x1](und): Audio: ${desc} (default)`,
  ]

  it('keeps codec, profile, rate and layout; drops sample format and bitrate', () => {
    expect(audioStreamSignature(log('aac (LC) (mp4a / 0x6134706D), 22050 Hz, mono, fltp, 58 kb/s')))
      .toBe('aac (LC) (mp4a / 0x6134706D), 22050 Hz, mono')
  })

  it('returns null when there is no audio stream line', () => {
    expect(audioStreamSignature(['At least one output file must be specified'])).toBeNull()
  })

  it('allows a copy-join only for identical AAC signatures', () => {
    const stereo = 'aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo'
    expect(canCopyStreams([stereo, stereo])).toBe(true)
    // same bitrate differences are fine — they aren't in the signature
    expect(canCopyStreams([stereo, 'aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono'])).toBe(false)
    expect(canCopyStreams([stereo, 'aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo'])).toBe(false)
    expect(canCopyStreams([stereo, 'aac (HE-AAC) (mp4a / 0x6134706D), 44100 Hz, stereo'])).toBe(false)
    expect(canCopyStreams(['alac (alac / 0x63616C61), 44100 Hz, stereo'])).toBe(false)
    expect(canCopyStreams([stereo, null])).toBe(false)
    expect(canCopyStreams([])).toBe(false)
  })
})

describe('buildTimedConcatList', () => {
  it('writes each part with its exact decoded length', () => {
    expect(buildTimedConcatList([
      { name: 'enc_0.m4a', durationSec: 147456 / 44100 },
      { name: 'enc_1.m4a', durationSec: 2.5 },
    ])).toBe("file 'enc_0.m4a'\nduration 3.343673\nfile 'enc_1.m4a'\nduration 2.500000\n")
  })

  it('leaves the duration out for a part whose length is unknown', () => {
    expect(buildTimedConcatList([{ name: 'enc_0.m4a', durationSec: null }])).toBe("file 'enc_0.m4a'\n")
  })
})
