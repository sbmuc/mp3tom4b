// @vitest-environment node
/**
 * One ffmpeg instance runs many commands in a session: the M4B-to-MP3 splitter
 * runs one per chapter, and the shared instance serves every tool until the
 * page reloads. The stock core leaked wasm stack on every run and crashed with
 * "memory access out of bounds" after ~65 MP3 encodes; the shipped core is
 * patched (scripts/patch-ffmpeg-core.mjs).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { splitM4B } from '@/lib/ffmpeg/split'
import { toneFile } from './helpers'

describe('one ffmpeg instance, many runs', () => {
  it('splits a book with 120 chapters into 120 MP3s', async () => {
    const file = await toneFile({ hz: 440, sec: 60, rate: 44100, channels: 1, format: 'm4a' })
    const chapters = Array.from({ length: 120 }, (_, i) => ({ title: `Chapter ${i + 1}`, startMs: i * 500, endMs: (i + 1) * 500 }))
    const result = await splitM4B({ file, bitrate: 64, chapters, meta: { album: 'Long Book' } })
    expect(result.count).toBe(120)
  }, 300_000)
})
