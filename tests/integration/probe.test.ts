// @vitest-environment node
/**
 * The merge tool probes every dropped file at the same moment on the shared
 * ffmpeg instance. Each probe must read its own file, not whichever one was
 * written last.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { probeM4bInfo } from '@/lib/ffmpeg/probeM4b'
import { probeChapters } from '@/lib/ffmpeg/splitChapters'

const fixture = (name: string) => new File([readFileSync(path.resolve(__dirname, '../fixtures', name))], name)

describe('probing files dropped together', () => {
  it('reads each file’s own chapters and length', async () => {
    const chaptered = fixture('aac-3-chapters.m4b')
    const plain = fixture('aac-22k-mono-faststart.m4a')
    const [chapA, chapB, infoA, infoB] = await Promise.all([
      probeChapters(chaptered),
      probeChapters(plain),
      probeM4bInfo(chaptered),
      probeM4bInfo(plain),
    ])
    expect(chapA).toHaveLength(3)
    expect(chapB).toHaveLength(0)
    expect(infoA.chapterCount).toBe(3)
    expect(infoB.chapterCount).toBe(0)
    expect(infoA.durationMs).not.toBe(infoB.durationMs)
  })
})
