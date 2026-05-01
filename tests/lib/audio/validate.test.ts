import { describe, expect, it } from 'vitest'
import { MAX_TOTAL_BYTES, isAudioFile, validateFiles } from '@/lib/audio/validate'

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(0)], name, { type })
}

describe('isAudioFile', () => {
  it('accepts files with known audio MIME types', () => {
    expect(isAudioFile(makeFile('a.mp3', 'audio/mpeg'))).toBe(true)
    expect(isAudioFile(makeFile('a.m4a', 'audio/mp4'))).toBe(true)
    expect(isAudioFile(makeFile('a.m4a', 'audio/x-m4a'))).toBe(true)
    expect(isAudioFile(makeFile('a.wav', 'audio/wav'))).toBe(true)
    expect(isAudioFile(makeFile('a.wav', 'audio/x-wav'))).toBe(true)
    expect(isAudioFile(makeFile('a.flac', 'audio/flac'))).toBe(true)
    expect(isAudioFile(makeFile('a.flac', 'audio/x-flac'))).toBe(true)
    expect(isAudioFile(makeFile('a.ogg', 'audio/ogg'))).toBe(true)
    expect(isAudioFile(makeFile('a.opus', 'audio/opus'))).toBe(true)
  })

  it('falls back to extension when MIME is empty or unknown', () => {
    expect(isAudioFile(makeFile('song.mp3', ''))).toBe(true)
    expect(isAudioFile(makeFile('song.flac', 'application/octet-stream'))).toBe(true)
    expect(isAudioFile(makeFile('song.OPUS', ''))).toBe(true)
  })

  it('rejects non-audio MIME types with non-audio extensions', () => {
    expect(isAudioFile(makeFile('doc.pdf', 'application/pdf'))).toBe(false)
    expect(isAudioFile(makeFile('clip.mp4', 'video/mp4'))).toBe(false)
    expect(isAudioFile(makeFile('img.png', 'image/png'))).toBe(false)
  })

  it('rejects extensionless unknown files', () => {
    expect(isAudioFile(makeFile('README', ''))).toBe(false)
  })
})

describe('validateFiles', () => {
  it('partitions files into valid and rejected', () => {
    const files = [
      makeFile('a.mp3', 'audio/mpeg'),
      makeFile('b.txt', 'text/plain'),
      makeFile('c.flac', 'audio/flac'),
      makeFile('d.mov', 'video/quicktime'),
    ]
    const { valid, rejected } = validateFiles(files)
    expect(valid.map((f) => f.name)).toEqual(['a.mp3', 'c.flac'])
    expect(rejected.map((f) => f.name)).toEqual(['b.txt', 'd.mov'])
  })

  it('returns empty arrays for empty input', () => {
    const { valid, rejected } = validateFiles([])
    expect(valid).toEqual([])
    expect(rejected).toEqual([])
  })
})

describe('MAX_TOTAL_BYTES', () => {
  it('equals 1.5 GiB', () => {
    expect(MAX_TOTAL_BYTES).toBe(1.5 * 1024 * 1024 * 1024)
  })
})
