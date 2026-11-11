import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coverSide, resizeCoverImage } from '@/lib/image/resize'

interface FakeCanvas {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toBlob: ReturnType<typeof vi.fn>
  _fillRect: ReturnType<typeof vi.fn>
  _drawImage: ReturnType<typeof vi.fn>
  _ctx: { fillStyle: string; fillRect: unknown; drawImage: unknown }
}

function makeFakeCanvas(toBlobSizes: number[]): FakeCanvas {
  const fillRect = vi.fn()
  const drawImage = vi.fn()
  const ctx = { fillStyle: '', fillRect, drawImage }

  let calls = 0
  const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
    const size = toBlobSizes[Math.min(calls, toBlobSizes.length - 1)]
    calls++
    // Native canvas calls the callback async — emulate that.
    queueMicrotask(() => {
      callback(new Blob([new Uint8Array(size)], { type: type || 'image/jpeg' }))
    })
  })

  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob,
    _fillRect: fillRect,
    _drawImage: drawImage,
    _ctx: ctx,
  }
}

let fakeCanvas: FakeCanvas

beforeEach(() => {
  fakeCanvas = makeFakeCanvas([10_000])

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_input: unknown) => ({ width: 800, height: 800 }))
  )

  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return fakeCanvas as unknown as HTMLCanvasElement
    return realCreate(tag)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const dummyFile = () => new File([new Uint8Array(0)], 'cover.jpg', { type: 'image/jpeg' })

describe('coverSide', () => {
  it('keeps the longer side, up to 1200, and never enlarges', () => {
    expect(coverSide(800, 800)).toBe(800)
    expect(coverSide(500, 500)).toBe(500)
    expect(coverSide(2400, 2400)).toBe(1200)
    expect(coverSide(2000, 500)).toBe(1200)
    expect(coverSide(600, 900)).toBe(900)
    expect(coverSide(40, 40)).toBe(40)
  })
})

describe('resizeCoverImage', () => {
  it('returns a Blob within the size budget on the first toBlob call, at quality 0.9', async () => {
    fakeCanvas = makeFakeCanvas([300_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe(300_000)
    // One toBlob call is enough: 300 KB fits the 500 KB budget.
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(1)
    expect(fakeCanvas.toBlob.mock.calls[0][2]).toBe(0.9)
  })

  it('makes the canvas the size of the image, not larger', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    await resizeCoverImage(dummyFile())
    expect(fakeCanvas.width).toBe(800)
    expect(fakeCanvas.height).toBe(800)
  })

  it('shrinks a large image to 1200×1200', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2400, height: 2400, close: vi.fn() })))
    await resizeCoverImage(dummyFile())
    expect(fakeCanvas.width).toBe(1200)
    expect(fakeCanvas._drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 1200, 1200])
  })

  it('paints a white background then draws the bitmap', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    await resizeCoverImage(dummyFile())
    expect(fakeCanvas._ctx.fillStyle).toBe('#ffffff')
    expect(fakeCanvas._fillRect).toHaveBeenCalledWith(0, 0, 800, 800)
    expect(fakeCanvas._drawImage).toHaveBeenCalledTimes(1)
  })

  it('centers and pillarboxes a portrait (non-square) bitmap', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 600, height: 1200 }))
    )
    await resizeCoverImage(dummyFile())
    // side = 1200, scale = 1 → drawn at 600×1200, centered:
    // x = (1200 - 600) / 2 = 300, y = 0
    const args = fakeCanvas._drawImage.mock.calls[0]
    expect(args[1]).toBe(300) // x
    expect(args[2]).toBe(0) // y
    expect(args[3]).toBe(600) // w
    expect(args[4]).toBe(1200) // h
  })

  it('steps the quality down until the result fits the size budget', async () => {
    // 1st call too large, 2nd call fits.
    fakeCanvas = makeFakeCanvas([600_000, 450_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob.size).toBe(450_000)
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(2)
    const firstQuality = fakeCanvas.toBlob.mock.calls[0][2] as number
    const secondQuality = fakeCanvas.toBlob.mock.calls[1][2] as number
    expect(secondQuality).toBeLessThan(firstQuality)
  })

  it('stops at quality 0.75 when nothing fits', async () => {
    fakeCanvas = makeFakeCanvas([900_000, 800_000, 700_000, 600_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob.size).toBe(600_000)
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(4)
    expect(fakeCanvas.toBlob.mock.calls[3][2]).toBe(0.75)
  })
})

describe('coverProblem', () => {
  it("says why an image can't be the cover", async () => {
    const { coverProblem } = await import('@/lib/image/validate')
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('decode'))))
    expect(await coverProblem(new File([], 'IMG_0001.HEIC', { type: 'image/heic' }))).toMatch(/HEIC image .* this browser can't open/)
    expect(await coverProblem(new File([], 'broken.jpg', { type: 'image/jpeg' }))).toBe('That image could not be read. Try a different JPG, PNG or WebP.')
    expect(await coverProblem(new File([], 'notes.txt', { type: 'text/plain' }))).toBe('"notes.txt" isn\'t an image. Pick a JPG, PNG or WebP.')
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close: () => {} })))
    expect(await coverProblem(new File([], 'cover.webp', { type: 'image/webp' }))).toBeNull()
  })
})
