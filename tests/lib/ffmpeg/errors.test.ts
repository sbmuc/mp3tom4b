import { describe, expect, it } from 'vitest'
import { OUT_OF_MEMORY, failureReason, humanizeFfmpegError } from '@/lib/ffmpeg/errors'

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

describe('failureReason', () => {
  it('sorts failures into anonymous kinds', () => {
    expect(failureReason(new Error('RuntimeError: memory access out of bounds'))).toBe('out_of_memory')
    expect(failureReason(new RangeError('Array buffer allocation failed'))).toBe('out_of_memory')
    expect(failureReason(28)).toBe('out_of_memory')
    expect(failureReason(new Error('Aborted()'))).toBe('interrupted')
    expect(failureReason(1)).toBe('unreadable_input')
    expect(failureReason(new Error('chapter 3/10: Invalid data found when processing input'))).toBe('unreadable_input')
    expect(failureReason(new Error('something else'))).toBe('other')
  })
})
