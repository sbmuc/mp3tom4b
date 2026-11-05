// @vitest-environment node
/**
 * Running out of memory, for real, on the shipped core: ffmpeg's own
 * allocation limit (-max_alloc) makes a single allocation fail, and areverse,
 * which keeps all audio until the end, fills the 2 GB wasm heap. Both must be
 * reported as out of memory (run.ts), so the user gets the advice that helps
 * (another tab closed, a lower bitrate) instead of an exit code.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { describe, expect, it } from 'vitest'
import { failureReason, humanizeFfmpegError, OUT_OF_MEMORY } from '@/lib/ffmpeg/errors'
import { FFmpegExitError, runFFmpeg } from '@/lib/ffmpeg/run'
import { NodeFFmpeg } from './nodeFFmpeg'

const asFFmpeg = (ff: NodeFFmpeg) => ff as unknown as FFmpeg
const encode = (extra: string[] = []) => ['-hide_banner', ...extra, '-i', 'in.mp3', '-c:a', 'aac', '-b:a', '64k', '-y', 'out.m4a']

async function failure(ff: NodeFFmpeg, args: string[]): Promise<FFmpegExitError> {
  const err = await runFFmpeg(asFFmpeg(ff), args).then(() => null, (e: unknown) => e)
  expect(err).toBeInstanceOf(FFmpegExitError)
  return err as FFmpegExitError
}

describe('running out of memory', () => {
  it('reports a failed allocation as out of memory, however ffmpeg words it', async () => {
    const ff = await NodeFFmpeg.create()
    await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=10', '-c:a', 'libmp3lame', '-b:a', '64k', 'in.mp3'])
    // "in.mp3: Out of memory" and "Error allocating the encoding context."
    for (const limit of ['20000', '100000']) {
      const err = await failure(ff, encode(['-max_alloc', limit]))
      expect(err.kind, `-max_alloc ${limit}`).toBe('out_of_memory')
      expect(failureReason(err)).toBe('out_of_memory')
      expect(humanizeFfmpegError(err)).toBe(OUT_OF_MEMORY)
    }
    // And the same instance converts normally afterwards. -max_alloc is a
    // global setting that stays on the instance (like the log level), so put
    // back ffmpeg's default (INT_MAX) first; the tools never set it.
    await expect(runFFmpeg(asFFmpeg(ff), encode(['-max_alloc', '2147483647']))).resolves.toBeUndefined()
  })

  it('reports a full wasm heap as out of memory, and the instance still works after', async () => {
    const ff = await NodeFFmpeg.create()
    // 2.5 h of stereo float kept in memory by areverse: more than the 2 GB heap.
    const err = await failure(ff, [
      '-hide_banner', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=9000:sample_rate=48000',
      '-af', 'aformat=sample_fmts=fltp:channel_layouts=stereo,areverse', '-f', 'null', '-',
    ])
    expect(err.kind).toBe('out_of_memory')
    // ffmpeg frees what it had before exiting, so even a big job fits again on
    // the same instance (the tools still start fresh after a failure, for the
    // failures that don't clean up, like a trap).
    await expect(
      runFFmpeg(asFFmpeg(ff), [
        '-hide_banner', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4300:sample_rate=48000',
        '-af', 'aformat=sample_fmts=fltp:channel_layouts=stereo,areverse', '-f', 'null', '-',
      ]),
    ).resolves.toBeUndefined()
  })
})
