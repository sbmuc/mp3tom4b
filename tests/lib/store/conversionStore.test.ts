import { beforeEach, describe, expect, it } from 'vitest'
import { buildKey, useConversionStore } from '@/lib/store/conversionStore'

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

describe('keeping the last M4B for a quick update', () => {
  const audio = (name: string) =>
    ({
      id: name,
      file: new File([new Uint8Array([1])], name),
      chapterTitle: name,
      originalChapterTitle: name,
      duration: 10,
    }) as import('@/types').AudioFile
  const build = () => ({ blob: new Blob([new Uint8Array([1])]), key: buildKey(store().files, store().bitrate), starts: [0, 10_000], durationMs: 20_000, cover: null })

  beforeEach(() => {
    store().reset()
    store().addFiles([audio('b.mp3'), audio('a.mp3')])
    store().setOutputBlob(new Blob([new Uint8Array([1])]))
    store().setLastBuild(build())
  })

  it('keeps it when a title, a tag or the cover changes', () => {
    store().updateChapterTitle('a.mp3', 'Renamed')
    store().setMetadata({ title: 'New title' })
    store().setCoverFile(image('picked.jpg'))
    expect(store().outputBlob).toBeNull()
    expect(store().lastBuild).not.toBeNull()
    expect(store().lastBuild?.key).toBe(buildKey(store().files, store().bitrate))
  })

  it('lets it go when the files, their order or the bitrate change', () => {
    store().setBitrate(96)
    expect(store().lastBuild).toBeNull()
    store().setLastBuild(build())
    store().removeFile('b.mp3')
    expect(store().lastBuild).toBeNull()
  })

  it('clears the result when sorting changes the order, and only then', () => {
    // Sorted A→Z already: sorting A→Z again changes nothing.
    store().setSortDirection('asc')
    expect(store().outputBlob).not.toBeNull()
    store().setSortDirection('desc')
    expect(store().outputBlob).toBeNull()
    expect(store().lastBuild).toBeNull()
  })

  it('keys a build by the files, their order and the bitrate', () => {
    expect(buildKey([{ id: 'a' }, { id: 'b' }], 64)).not.toBe(buildKey([{ id: 'b' }, { id: 'a' }], 64))
    expect(buildKey([{ id: 'a' }], 64)).not.toBe(buildKey([{ id: 'a' }], 96))
  })
})
