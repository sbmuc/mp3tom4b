import { describe, expect, it } from 'vitest'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { FFmpegExitError, runFFmpeg } from '@/lib/ffmpeg/run'

type LogListener = (e: { message: string }) => void

/** An FFmpeg whose exec prints `log` and returns `code`. */
function fakeFFmpeg(code: number, log: string[] = []) {
  const listeners = new Set<LogListener>()
  const ffmpeg = {
    on: (_: 'log', fn: LogListener) => void listeners.add(fn),
    off: (_: 'log', fn: LogListener) => void listeners.delete(fn),
    exec: async () => {
      for (const message of log) listeners.forEach((fn) => fn({ message }))
      return code
    },
  }
  return { ffmpeg: ffmpeg as unknown as FFmpeg, listeners }
}

describe('runFFmpeg', () => {
  it('returns when ffmpeg succeeds and removes its log listener', async () => {
    const { ffmpeg, listeners } = fakeFFmpeg(0, ['size=  1024kB time=00:01:00'])
    await expect(runFFmpeg(ffmpeg, ['-i', 'x'])).resolves.toBeUndefined()
    expect(listeners.size).toBe(0)
  })

  it('throws with the exit code when ffmpeg fails', async () => {
    const { ffmpeg, listeners } = fakeFFmpeg(1, ['Invalid argument'])
    const err = await runFFmpeg(ffmpeg, []).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(FFmpegExitError)
    expect((err as FFmpegExitError).code).toBe(1)
    expect((err as FFmpegExitError).kind).toBe('unknown')
    expect((err as Error).message).toBe('ffmpeg exited with code 1')
    expect(listeners.size).toBe(0)
  })

  it('says out of memory when ffmpeg logged an allocation failure', async () => {
    const { ffmpeg } = fakeFFmpeg(1, ['[aac @ 0x1] Error while encoding: Cannot allocate memory'])
    const err = (await runFFmpeg(ffmpeg, []).catch((e: unknown) => e)) as FFmpegExitError
    expect(err.kind).toBe('out_of_memory')
    expect(err.message).toBe('ffmpeg ran out of memory (exit code 1)')
  })

  it('says the input could not be read when ffmpeg logged invalid data', async () => {
    const { ffmpeg } = fakeFFmpeg(1, ['/mnt/in.m4b: Invalid data found when processing input'])
    const err = (await runFFmpeg(ffmpeg, []).catch((e: unknown) => e)) as FFmpegExitError
    expect(err.kind).toBe('unreadable_input')
    expect(err.message).toBe("ffmpeg couldn't read the input (exit code 1)")
  })
})
