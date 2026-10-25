import { describe, expect, it } from 'vitest'
import { OUT_OF_MEMORY, humanizeFfmpegError } from '@/lib/ffmpeg/errors'

describe('humanizeFfmpegError', () => {
  it('explains running out of memory, however the browser reports it', () => {
    expect(humanizeFfmpegError(new RangeError('Array buffer allocation failed'))).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError(new Error('encoding chapter 3/20: RuntimeError: memory access out of bounds'))).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError('Aborted(OOM). Out of memory')).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError(28)).toBe(OUT_OF_MEMORY)
  })

  it('keeps the chapter and step of other failures', () => {
    expect(humanizeFfmpegError(new Error('reading chapter 2/5: file not found'))).toBe('reading chapter 2/5: file not found')
  })

  it('turns an interrupted run into a refresh hint', () => {
    expect(humanizeFfmpegError(new Error('RuntimeError: unreachable'))).toMatch(/interrupted/)
  })
})
