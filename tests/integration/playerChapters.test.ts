// @vitest-environment node
/**
 * The player's chapter reader (src/lib/audio/mp4Chapters.ts) against real
 * converter output: it must list the same chapters ffmpeg itself reads back,
 * with the moov box at the start (our output) or at the end (other tools).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { convertToM4B } from '@/lib/ffmpeg/convert'
import { readMp4Chapters } from '@/lib/audio/mp4Chapters'
import { readPlaybackInfo } from '@/lib/audio/playback'
import { NodeFFmpeg } from './nodeFFmpeg'
import { META, TEN_ODD_CHAPTERS, analyze, asAudioFile, toneFile } from './helpers'

const TITLES = ['Prologue', 'Één — begin', 'Chapter "3"', '第四章', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Epilogue']

async function convertTen(): Promise<Blob> {
  const files = await Promise.all(
    TEN_ODD_CHAPTERS.map(async (s, i) => ({ ...(await asAudioFile(await toneFile(s), i)), chapterTitle: TITLES[i] })),
  )
  return convertToM4B({ files, metadata: META, coverFile: null, bitrate: 64, onProgress: () => {} })
}

describe('player chapter reader on real output', () => {
  it('lists every chapter of a converted M4B, as ffmpeg reads them', async () => {
    const out = await convertTen()
    const ffmpeg = (await analyze(new Uint8Array(await out.arrayBuffer()))).chapters
    const ours = await readMp4Chapters(out)

    expect(ours.map((c) => c.title)).toEqual(TITLES)
    expect(ours.map((c) => c.title)).toEqual(ffmpeg.map((c) => c.title))
    ours.forEach((c, i) => expect(c.startSec * 1000).toBeCloseTo(ffmpeg[i].startMs, 0))

    const info = await readPlaybackInfo(out)
    expect(info.title).toBe(META.title)
    expect(info.author).toBe(META.author)
    expect(info.chapters).toEqual(ours)
  })

  it('reads the same chapters when the moov box is at the end of the file', async () => {
    const out = await convertTen()
    const ff = await NodeFFmpeg.create()
    await ff.writeFile('in.m4b', new Uint8Array(await out.arrayBuffer()))
    // Plain remux, no +faststart: the moov box moves behind the audio.
    expect((await ff.run(['-i', 'in.m4b', '-map', '0:a', '-c', 'copy', '-f', 'mp4', 'end.m4b'])).ret).toBe(0)
    const moovAtEnd = await ff.readFile('end.m4b')
    const firstBoxes = new TextDecoder().decode(moovAtEnd.subarray(0, 64))
    expect(firstBoxes).not.toContain('moov')

    expect(await readMp4Chapters(new Blob([new Uint8Array(moovAtEnd)]))).toEqual(await readMp4Chapters(out))
  })
})
