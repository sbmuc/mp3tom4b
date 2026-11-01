import { beforeEach, describe, expect, it } from 'vitest'
import { useConversionStore } from '@/lib/store/conversionStore'

const image = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' })
const store = () => useConversionStore.getState()

describe('cover precedence: picked, then dropped, then embedded in the audio', () => {
  beforeEach(() => store().reset())

  it('uses the cover embedded in the audio when there is none yet', () => {
    const embedded = image('embedded.jpg')
    store().applyAutoMetadata({ coverFile: embedded })
    expect(store().coverFile).toBe(embedded)
    expect(store().coverSource).toBe('auto')
  })

  it('keeps an image dropped with the audio over the one embedded in it', () => {
    const dropped = image('cover.jpg')
    store().setCoverFileDrop(dropped)
    store().applyAutoMetadata({ coverFile: image('embedded.jpg') })
    expect(store().coverFile).toBe(dropped)
    expect(store().coverSource).toBe('drop')
  })

  it('keeps a cover picked in the Cover image section', () => {
    const picked = image('picked.jpg')
    store().setCoverFile(picked)
    store().applyAutoMetadata({ coverFile: image('embedded.jpg') })
    expect(store().coverFile).toBe(picked)
    expect(store().coverSource).toBe('user')
  })

  it('lets a later drop replace a cover from the audio', () => {
    store().applyAutoMetadata({ coverFile: image('embedded.jpg') })
    const dropped = image('cover.jpg')
    store().setCoverFileDrop(dropped)
    expect(store().coverFile).toBe(dropped)
    expect(store().coverSource).toBe('drop')
  })
})
