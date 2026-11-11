import { describe, expect, it } from 'vitest'
import { buildJobs, findShortChapters, MIN_SPLIT_SEC, pickCuts, piecesPerFile } from '@/lib/ffmpeg/pieces'
import { buildEncodeArgs } from '@/lib/ffmpeg/concatPlan'

const H = 3600
const MIN = 60

describe('piecesPerFile', () => {
  it('cuts one long file into a piece per worker', () => {
    expect(piecesPerFile([1 * H], 3)).toEqual([3])
    expect(piecesPerFile([11.5 * H], 3)).toEqual([3])
    expect(piecesPerFile([11.5 * H], 2)).toEqual([2])
  })

  it('never cuts a file of up to 20 minutes, nor on one worker', () => {
    expect(piecesPerFile([MIN_SPLIT_SEC], 3)).toEqual([1])
    expect(piecesPerFile([19 * MIN, 5 * MIN], 3)).toEqual([1, 1])
    expect(piecesPerFile([5 * H], 1)).toEqual([1])
  })

  it('leaves a book of many chapters alone: the workers share it already', () => {
    expect(piecesPerFile(Array(30).fill(30 * MIN), 3)).toEqual(Array(30).fill(1))
  })

  it("cuts a long file only when it is longer than a worker's share of the book", () => {
    // The owner's Order of the Phoenix folder: 36 chapters and a stray
    // 11.5-hour MP3. Started first (longest jobs go first), the long file
    // takes about as long as the other two workers need for the rest.
    const phoenix = [...Array(36).fill(40 * MIN), 11.5 * H]
    expect(piecesPerFile(phoenix, 3)).toEqual(Array(37).fill(1))
    // One 11.5-hour file with a few short ones is cut.
    const pieces = piecesPerFile([10 * MIN, 10 * MIN, 11.5 * H], 3)
    expect(pieces).toEqual([1, 1, 3])
  })

  it('counts a file of unknown length as nothing to cut', () => {
    expect(piecesPerFile([null, 2 * H], 3)).toEqual([1, 3])
  })
})

describe('pickCuts', () => {
  const pause = (atSec: number, lenSec = 1) => ({ startMs: (atSec - lenSec / 2) * 1000, endMs: (atSec + lenSec / 2) * 1000 })

  it('cuts in the middle of the pause nearest each even split', () => {
    const pauses = [pause(1150), pause(1230), pause(2380), pause(2500)]
    expect(pickCuts(3600, 3, pauses)).toEqual([1230, 2380])
  })

  it('skips a split point with no pause within reach, rather than cut in a word', () => {
    // Nothing within 5 minutes of 40:00; the 20:00 cut is kept.
    expect(pickCuts(3600, 3, [pause(1210), pause(3000)])).toEqual([1210])
    expect(pickCuts(3600, 3, [])).toEqual([])
  })

  it('keeps every piece at least a minute long, and cuts increasing', () => {
    expect(pickCuts(3600, 3, [pause(10), pause(3595)])).toEqual([])
    const cuts = pickCuts(2 * H, 3, [pause(2410), pause(2420), pause(4790), pause(4810)])
    expect(cuts).toEqual([2410, 4790])
  })

  it('does nothing for one piece', () => {
    expect(pickCuts(3600, 1, [pause(1800)])).toEqual([])
  })
})

describe('buildJobs', () => {
  it('makes one job per uncut file and one per piece, in book order', () => {
    const jobs = buildJobs([100, 3600, 50], [[], [1200, 2400], []])
    expect(jobs.map((j) => [j.file, j.startSec, j.endSec, j.weight, j.trimmed])).toEqual([
      [0, 0, null, 100, false],
      [1, 0, 1200, 1200, true],
      [1, 1200, 2400, 1200, true],
      [1, 2400, null, 1200, true],
      [2, 0, null, 50, false],
    ])
  })
})

describe('buildEncodeArgs with a trim', () => {
  const target = { sampleRate: 44100, channels: 1 as const }
  it('trims the decoded audio to the piece, sample-exact, and restarts its timestamps', () => {
    const args = buildEncodeArgs({ input: 'in.mp3', output: 'o.m4a', bitrate: 64, target, trim: { startSec: 1200.5, endSec: 2400 } })
    expect(args.join(' ')).toContain('-vn -af atrim=start=1200.500000:end=2400.000000,asetpts=PTS-STARTPTS -c:a aac')
  })
  it('runs the last piece to the end of the file', () => {
    const args = buildEncodeArgs({ input: 'in.mp3', output: 'o.m4a', bitrate: 64, target, trim: { startSec: 2400, endSec: null } })
    expect(args.join(' ')).toContain('-af atrim=start=2400.000000,asetpts=PTS-STARTPTS')
  })
  it('leaves a whole file as it was', () => {
    expect(buildEncodeArgs({ input: 'in.mp3', output: 'o.m4a', bitrate: 64, target }).join(' ')).not.toContain('atrim')
  })
})

describe('findShortChapters', () => {
  it("flags a chapter much shorter than its file: part of it couldn't be decoded", () => {
    expect(findShortChapters([{ title: 'Half damaged', expectedSec: 30, gotSec: 15 }])).toEqual([
      { title: 'Half damaged', expectedSec: 30, gotSec: 15 },
    ])
  })

  it('lets the usual few milliseconds, and estimates a little off, pass', () => {
    expect(
      findShortChapters([
        { title: 'Encoder padding', expectedSec: 1800, gotSec: 1800.03 },
        { title: 'Tag a bit long', expectedSec: 2472, gotSec: 2460 },
        { title: 'Tiny file', expectedSec: 2, gotSec: 0.5 },
        { title: 'Unknown', expectedSec: null, gotSec: 10 },
        { title: 'Unread', expectedSec: 30, gotSec: null },
      ]),
    ).toEqual([])
  })
})
