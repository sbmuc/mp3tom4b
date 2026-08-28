import { describe, expect, it } from 'vitest'
import { parseM4bProbe } from '@/lib/ffmpeg/probeM4b'

// Representative ffmpeg `-i` header dump for a chaptered M4B with cover art.
const CHAPTERED_WITH_COVER = [
  "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'probe_m4b_1':",
  '  Metadata:',
  '    major_brand     : M4A',
  '    title           : My Book',
  '    artist          : Some Author',
  '  Duration: 08:12:34.00, start: 0.000000, bitrate: 128 kb/s',
  '  Chapter #0:0: start 0.000000, end 1800.000000',
  '    Metadata:',
  '      title           : Chapter 1',
  '  Chapter #0:1: start 1800.000000, end 3600.000000',
  '  Chapter #0:2: start 3600.000000, end 5400.000000',
  '  Stream #0:0[0x1](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s',
  '  Stream #0:1[0x2](und): Video: mjpeg (Baseline), yuvj444p, 1200x1200, 90k tbr, attached pic',
]

describe('parseM4bProbe', () => {
  it('parses duration, bitrate, chapter count, and cover presence', () => {
    const info = parseM4bProbe(CHAPTERED_WITH_COVER)
    expect(info.durationMs).toBe(((8 * 3600 + 12 * 60 + 34) * 100) * 10)
    expect(info.currentBitrateKbps).toBe(128)
    expect(info.chapterCount).toBe(3)
    expect(info.hasCover).toBe(true)
  })

  it('reports no chapters and no cover for a plain audio-only file', () => {
    const info = parseM4bProbe([
      '  Duration: 01:03:00.00, start: 0.000000, bitrate: 64 kb/s',
      '  Stream #0:0[0x1](und): Audio: aac (LC), 44100 Hz, mono, fltp, 64 kb/s',
    ])
    expect(info.currentBitrateKbps).toBe(64)
    expect(info.chapterCount).toBe(0)
    expect(info.hasCover).toBe(false)
    expect(info.durationMs).toBe((1 * 3600 + 3 * 60) * 1000)
  })

  it('returns nulls when the header is missing', () => {
    const info = parseM4bProbe(['some unrelated line', 'another line'])
    expect(info.durationMs).toBeNull()
    expect(info.currentBitrateKbps).toBeNull()
    expect(info.chapterCount).toBe(0)
    expect(info.hasCover).toBe(false)
  })

  it('detects a cover from an attached_pic line even without an explicit Video stream match', () => {
    const info = parseM4bProbe([
      '  Duration: 00:30:00.00, start: 0.000000, bitrate: 96 kb/s',
      '  Stream #0:1: Video: png, rgba, 600x600, attached pic',
    ])
    expect(info.hasCover).toBe(true)
  })
})
