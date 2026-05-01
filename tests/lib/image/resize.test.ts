import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resizeCoverImage } from '@/lib/image/resize'

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

describe('resizeCoverImage', () => {
  it('returns a Blob within the size budget on the first toBlob call', async () => {
    fakeCanvas = makeFakeCanvas([50_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe(50_000)
    // Only one toBlob call needed since 50KB <= 200KB.
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(1)
  })

  it('sizes the canvas to 1200×1200', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    await resizeCoverImage(dummyFile())
    expect(fakeCanvas.width).toBe(1200)
    expect(fakeCanvas.height).toBe(1200)
  })

  it('paints a white background then draws the bitmap', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    await resizeCoverImage(dummyFile())
    expect(fakeCanvas._ctx.fillStyle).toBe('#ffffff')
    expect(fakeCanvas._fillRect).toHaveBeenCalledWith(0, 0, 1200, 1200)
    expect(fakeCanvas._drawImage).toHaveBeenCalledTimes(1)
  })

  it('centers and pillarboxes a portrait (non-square) bitmap', async () => {
    fakeCanvas = makeFakeCanvas([1000])
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ width: 600, height: 1200 }))
    )
    await resizeCoverImage(dummyFile())
    // scale = min(1200/600, 1200/1200) = 1 → drawn at 600×1200, centered:
    // x = (1200 - 600) / 2 = 300, y = (1200 - 1200) / 2 = 0
    const args = fakeCanvas._drawImage.mock.calls[0]
    expect(args[1]).toBe(300) // x
    expect(args[2]).toBe(0) // y
    expect(args[3]).toBe(600) // w
    expect(args[4]).toBe(1200) // h
  })

  it('decrements quality until the result fits the size budget', async () => {
    // 1st call too large, 2nd call fits.
    fakeCanvas = makeFakeCanvas([300_000, 150_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob.size).toBe(150_000)
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(2)

    // The quality should have been reduced on the 2nd call.
    const firstQuality = fakeCanvas.toBlob.mock.calls[0][2] as number
    const secondQuality = fakeCanvas.toBlob.mock.calls[1][2] as number
    expect(secondQuality).toBeLessThan(firstQuality)
  })

  it('falls back to a final 0.5-quality attempt when all loop iterations are oversized', async () => {
    // All five loop iterations + one final fallback call = 6 total.
    fakeCanvas = makeFakeCanvas([300_000, 290_000, 280_000, 270_000, 260_000, 250_000])
    const blob = await resizeCoverImage(dummyFile())
    expect(blob.size).toBe(250_000)
    expect(fakeCanvas.toBlob).toHaveBeenCalledTimes(6)
    const finalQuality = fakeCanvas.toBlob.mock.calls[5][2] as number
    expect(finalQuality).toBe(0.5)
  })
})
