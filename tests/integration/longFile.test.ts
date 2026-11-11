// @vitest-environment node
/**
 * One long file in the converter is cut into pieces that the workers encode
 * side by side (pieces.ts). Each join adds ~30 ms of near-silence, so the
 * cuts must land in pauses: this checks that the file was really cut, that
 * nothing went quiet outside the pauses, and that the chapter markers after
 * the long file still sit on the audio.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { convertToM4B } from '@/lib/ffmpeg/convert'
import { NodeFFmpeg } from './nodeFFmpeg'
import { META, analyze, asAudioFile, expectAppleDecodes, mp3, onsetMs, toneFile, type Analysis } from './helpers'

const RATE = 22050
const BLOCK_SEC = 50 // 49 s of tone, then 1 s of silence
const BLOCKS = 30 // 25 minutes: longer than MIN_SPLIT_SEC, so it is cut
const LONG_SEC = BLOCK_SEC * BLOCKS

/** A 25-minute "lecture": a 440 Hz tone with a one-second pause every 50 s. */
async function lectureFile(): Promise<File> {
  const ff = await NodeFFmpeg.create()
  const { ret } = await ff.run([
    '-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=${RATE}:duration=${LONG_SEC}`,
    '-af', `volume='if(lt(mod(t,${BLOCK_SEC}),${BLOCK_SEC - 1}),1,0)':eval=frame`,
    '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', 'lecture.mp3',
  ])
  expect(ret).toBe(0)
  return new File([new Uint8Array(await ff.readFile('lecture.mp3'))], 'lecture.mp3')
}

/** Start times (s) of 5 ms windows far quieter than the tone, between fromSec and toSec. */
function quietWindows(a: Analysis, fromSec: number, toSec: number): number[] {
  const n = Math.round(a.rate * 0.005)
  const rms = (s: number) => {
    let sum = 0
    for (let i = s; i < s + n; i++) sum += a.pcm[i] * a.pcm[i]
    return Math.sqrt(sum / n)
  }
  const level = rms(Math.round((fromSec + 1) * a.rate))
  const quiet: number[] = []
  for (let s = Math.round(fromSec * a.rate); s + n < Math.round(toSec * a.rate); s += n) {
    if (rms(s) < level * 0.3) quiet.push(s / a.rate)
  }
  return quiet
}

describe('convertToM4B — one long file shared between workers', () => {
  let a: Analysis
  let out: Uint8Array
  const execArgs: string[][] = []
  let restoreExec = () => {}

  beforeAll(async () => {
    // Record every command the converter runs, then run it as usual.
    const realExec = NodeFFmpeg.prototype.exec
    NodeFFmpeg.prototype.exec = function (this: NodeFFmpeg, args: string[]) {
      execArgs.push(args)
      return realExec.call(this, args)
    }
    restoreExec = () => {
      NodeFFmpeg.prototype.exec = realExec
    }
    const files = await Promise.all(
      [toneFile(mp3(300, RATE, 1, 5)), lectureFile(), toneFile(mp3(700, RATE, 1, 5))].map(async (f, i) =>
        asAudioFile(await f, i),
      ),
    )
    const result = await convertToM4B({ files, metadata: META, coverFile: null, bitrate: 32 })
    out = new Uint8Array(await result.blob.arrayBuffer())
    a = await analyze(out)
  }, 600_000)

  afterAll(() => restoreExec())

  it('cut the long file, in a pause', () => {
    const trims = execArgs
      .map((args) => args.find((x) => x.startsWith('atrim=')))
      .filter((x): x is string => x != null)
    expect(trims.length, 'pieces encoded with a trim').toBeGreaterThanOrEqual(2)
    const cuts = trims.map((t) => Number(t.match(/start=([\d.]+)/)?.[1])).filter((s) => s > 0)
    expect(cuts.length).toBeGreaterThanOrEqual(1)
    for (const cut of cuts) {
      const phase = cut % BLOCK_SEC
      expect(phase, `cut at ${cut} s is inside a pause`).toBeGreaterThan(BLOCK_SEC - 1)
    }
  })

  it('decodes cleanly, at the right length, with three chapters', () => {
    expect(a.decodeErrors).toEqual([])
    expect(a.chapters).toHaveLength(3)
    const seconds = a.pcm.length / a.rate
    expect(seconds).toBeGreaterThan(5 + LONG_SEC + 5 - 0.1)
    expect(seconds).toBeLessThan(5 + LONG_SEC + 5 + 0.5)
    expectAppleDecodes(out, 5 + LONG_SEC + 5)
  })

  it('goes quiet only in the pauses: no gap where a piece was joined', () => {
    const start = a.chapters[1].startMs / 1000
    const end = a.chapters[1].endMs / 1000
    const outside = quietWindows(a, start + 0.2, end - 1.2).filter((t) => {
      const phase = (t - start) % BLOCK_SEC
      // The pause, give or take the ~30 ms a join adds before it.
      return phase < BLOCK_SEC - 1 - 0.1 && phase > 0.15
    })
    expect(outside, 'quiet moments outside the pauses').toEqual([])
  })

  it('keeps the chapter after the long file on its first sound', () => {
    const { startMs } = a.chapters[2]
    const onset = onsetMs(a, 440, 700, startMs)
    expect(onset).not.toBeNull()
    expect(onset! - startMs).toBeGreaterThan(-10)
    // The converter's usual lead is one AAC priming frame: 1024 samples,
    // 46 ms at 22 kHz (the 45 ms in helpers.ts is for 44.1 kHz). The same
    // book with the long file uncut measured 48.5 ms too.
    expect(onset! - startMs).toBeLessThan((1024 / RATE) * 1000 + 10)
  })
})
