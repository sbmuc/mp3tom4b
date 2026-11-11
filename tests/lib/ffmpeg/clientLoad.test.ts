import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for @ffmpeg/ffmpeg: load() succeeds unless told otherwise.
const loadBehaviour = { fail: false }
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    terminated = false
    async load() {
      if (loadBehaviour.fail) throw new Error('worker import failed')
    }
    terminate() {
      this.terminated = true
    }
  },
}))

import { getFFmpeg, terminateFFmpeg } from '@/lib/ffmpeg/client'
import { ENGINE_DOWNLOAD_FAILED, EngineLoadError, failureReason, humanizeFfmpegError } from '@/lib/ffmpeg/errors'

const okResponse = () => new Response(new Uint8Array([0, 97, 115, 109]), { status: 200 })

beforeEach(() => {
  terminateFFmpeg()
  loadBehaviour.fail = false
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
  URL.createObjectURL = vi.fn(() => 'blob:core')
})
afterEach(() => vi.unstubAllGlobals())

describe('getFFmpeg when the engine download fails', () => {
  it('rejects with an EngineLoadError when offline, and the message says so', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const err = await getFFmpeg().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(EngineLoadError)
    expect(humanizeFfmpegError(err)).toBe(ENGINE_DOWNLOAD_FAILED)
    expect(failureReason(err)).toBe('engine_download')
  })

  it('treats an HTTP error as a failed download, not as a broken engine', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>blocked</html>', { status: 403 })))
    const err = await getFFmpeg().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(EngineLoadError)
    expect((err as Error).message).toContain('HTTP 403')
  })

  it('tries again on the next call instead of keeping the failed attempt', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch')))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getFFmpeg()).rejects.toBeInstanceOf(EngineLoadError)
    fetchMock.mockImplementation(async () => okResponse())
    await expect(getFFmpeg()).resolves.toBeTruthy()
  })

  it('forgets a load that failed after the download too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okResponse()))
    loadBehaviour.fail = true
    await expect(getFFmpeg()).rejects.toThrow('worker import failed')
    loadBehaviour.fail = false
    await expect(getFFmpeg()).resolves.toBeTruthy()
  })
})
