// @vitest-environment node
/**
 * A file that's mostly undecodable, on the shipped core: ffmpeg gives up with
 * exit code 69 when more frames fail than -max_error_rate allows (2/3 by
 * default; a DRM-protected book fails nearly all of them). Seen in the field
 * after 17 minutes on an M4B. Here the audio of an M4B is scrambled with its
 * index intact, and the limit lowered so the scrambling reliably trips it.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { describe, expect, it } from 'vitest'
import { failureReason, humanizeFfmpegError } from '@/lib/ffmpeg/errors'
import { FFmpegExitError, runFFmpeg } from '@/lib/ffmpeg/run'
import { NodeFFmpeg } from './nodeFFmpeg'

describe('a mostly undecodable file', () => {
  it('is reported as damaged or protected, not as an exit code', async () => {
    const ff = await NodeFFmpeg.create()
    await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=60', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-f', 'mp4', 'good.m4b'])
    const bytes = new Uint8Array((await ff.readFile('good.m4b')) as Uint8Array)
    const mdat = new TextDecoder('latin1').decode(bytes).indexOf('mdat')
    let seed = 7
    for (let i = mdat + 2004; i < bytes.length - 2000; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      if (i % 10 !== 0) bytes[i] = seed & 0xff
    }
    await ff.writeFile('bad.m4b', bytes)

    // -max_error_rate is global and stays on the instance; this one is fresh and used once.
    const err = await runFFmpeg(ff as unknown as FFmpeg, [
      '-hide_banner', '-max_error_rate', '0.05', '-i', 'bad.m4b', '-c:a', 'libmp3lame', '-b:a', '64k', '-y', 'out.mp3',
    ]).then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(FFmpegExitError)
    expect((err as FFmpegExitError).code).toBe(69)
    expect((err as FFmpegExitError).kind).toBe('damaged_input')
    expect(failureReason(err)).toBe('damaged_input')
    expect(humanizeFfmpegError(err)).toMatch(/damaged, or protected with DRM/)
  })
})
