import { describe, expect, it } from 'vitest'
import { MAX_BOOKS, clearPosition, loadPosition, resumeKey, savePosition, shouldResume } from '@/lib/audio/resume'

/** An in-memory Storage. */
function memoryStore() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    map,
  }
}

describe('resumeKey', () => {
  it('is stable for the same name and size and hides the name', async () => {
    const a = await resumeKey('Anna Writer - The Quiet Valley.m4b', 3_500_000)
    expect(a).toBe(await resumeKey('Anna Writer - The Quiet Valley.m4b', 3_500_000))
    expect(a).not.toContain('Quiet')
    expect(a).toMatch(/^mp3tom4b\.resume\.[0-9a-f]{32}$/)
  })

  it('differs when the name or the size differs', async () => {
    const a = await resumeKey('book.m4b', 100)
    expect(await resumeKey('book.m4b', 101)).not.toBe(a)
    expect(await resumeKey('book2.m4b', 100)).not.toBe(a)
  })
})

describe('save, load, clear', () => {
  it('round-trips a position, rounded to the second', () => {
    const store = memoryStore()
    savePosition('mp3tom4b.resume.a', 754.6, store, 1)
    expect(loadPosition('mp3tom4b.resume.a', store)).toBe(755)
    clearPosition('mp3tom4b.resume.a', store)
    expect(loadPosition('mp3tom4b.resume.a', store)).toBeNull()
  })

  it('keeps only the most recently played books', () => {
    const store = memoryStore()
    store.setItem('other.setting', 'kept')
    for (let i = 0; i < MAX_BOOKS + 3; i++) savePosition(`mp3tom4b.resume.${i}`, 60, store, i)
    expect(loadPosition('mp3tom4b.resume.0', store)).toBeNull()
    expect(loadPosition('mp3tom4b.resume.2', store)).toBeNull()
    expect(loadPosition('mp3tom4b.resume.3', store)).toBe(60)
    expect(loadPosition(`mp3tom4b.resume.${MAX_BOOKS + 2}`, store)).toBe(60)
    expect(store.getItem('other.setting')).toBe('kept')
  })

  it('ignores a damaged entry, and works without storage', () => {
    const store = memoryStore()
    store.setItem('mp3tom4b.resume.x', '{not json')
    expect(loadPosition('mp3tom4b.resume.x', store)).toBeNull()
    expect(loadPosition('mp3tom4b.resume.x', null)).toBeNull()
    expect(() => savePosition('mp3tom4b.resume.x', 10, null)).not.toThrow()
  })

  it('survives storage that throws', () => {
    const broken = { ...memoryStore(), setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => savePosition('mp3tom4b.resume.x', 10, broken)).not.toThrow()
  })
})

describe('shouldResume', () => {
  it('skips the first and last half minute', () => {
    expect(shouldResume(null, 3600)).toBe(false)
    expect(shouldResume(10, 3600)).toBe(false)
    expect(shouldResume(30, 3600)).toBe(true)
    expect(shouldResume(3590, 3600)).toBe(false)
    expect(shouldResume(3570, 3600)).toBe(true)
  })

  it('resumes when the length is not known yet', () => {
    expect(shouldResume(1200, 0)).toBe(true)
  })
})
