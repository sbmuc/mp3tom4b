// @vitest-environment node
import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { entryBlob, isJunkEntry, readZipEntries, unzipFiles } from '@/lib/archive/zip'

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 251)
const asFile = (data: Uint8Array, name = 'book.zip') => new File([data as Uint8Array<ArrayBuffer>], name)
const text = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

describe('readZipEntries + entryBlob', () => {
  it('reads stored and deflated entries, skipping directories', async () => {
    const a = bytes(5000, 1)
    const b = new Uint8Array(20_000).fill(7) // compresses well
    const zip = asFile(zipSync({ 'Book/': {}, 'Book/01 Intro.mp3': [a, { level: 0 }], 'Book/02 Middle.mp3': [b, { level: 9 }] }))
    const entries = await readZipEntries(zip)
    expect(entries.map((e) => [e.path, e.name, e.method, e.size])).toEqual([
      ['Book/01 Intro.mp3', '01 Intro.mp3', 0, 5000],
      ['Book/02 Middle.mp3', '02 Middle.mp3', 8, 20_000],
    ])
    expect(await text(await entryBlob(zip, entries[0]))).toEqual(a)
    expect(await text(await entryBlob(zip, entries[1]))).toEqual(b)
  })

  it('keeps UTF-8 names', async () => {
    const zip = asFile(zipSync({ 'Hörbuch/Kapitel 1 – Anfang.mp3': bytes(10, 2) }))
    expect((await readZipEntries(zip))[0].name).toBe('Kapitel 1 – Anfang.mp3')
  })

  it('reads ZIP64 archives', async () => {
    const zip = asFile(zip64WithOneStoredEntry('big/part 1.m4b', bytes(300, 3)))
    const [e] = await readZipEntries(zip)
    expect([e.path, e.size, e.method]).toEqual(['big/part 1.m4b', 300, 0])
    expect(await text(await entryBlob(zip, e))).toEqual(bytes(300, 3))
  })

  it('rejects a file that is not a ZIP', async () => {
    await expect(readZipEntries(asFile(bytes(100, 4), 'fake.zip'))).rejects.toThrow(/not a ZIP/)
  })
})

describe('isJunkEntry', () => {
  it('drops macOS resource forks and hidden files', () => {
    expect(isJunkEntry({ path: '__MACOSX/Book/._01.mp3', name: '._01.mp3' })).toBe(true)
    expect(isJunkEntry({ path: 'Book/.DS_Store', name: '.DS_Store' })).toBe(true)
    expect(isJunkEntry({ path: 'Book/Thumbs.db', name: 'Thumbs.db' })).toBe(true)
    expect(isJunkEntry({ path: 'Book/01.mp3', name: '01.mp3' })).toBe(false)
  })
})

describe('unzipFiles', () => {
  const keep = (name: string) => /\.(mp3|jpg)$/i.test(name)

  it('unpacks wanted entries in path order across archives and lists the rest', async () => {
    const one = asFile(
      zipSync({
        'Book/CD2/01.mp3': bytes(10, 5),
        'Book/CD1/10.mp3': bytes(10, 6),
        'Book/CD1/2.mp3': bytes(10, 7),
        'Book/cover.jpg': bytes(10, 8),
        'Book/notes.txt': bytes(10, 9),
        '__MACOSX/Book/._cover.jpg': bytes(10, 10),
      }),
      'part1.zip',
    )
    const two = asFile(zipSync({ 'Book/CD3/01.mp3': bytes(10, 11) }), 'part2.zip')
    const progress: number[] = []
    const r = await unzipFiles([one, two], { keep, typeOf: (n) => (n.endsWith('.jpg') ? 'image/jpeg' : 'audio/mpeg'), onProgress: (d, t) => progress.push(d / t) })
    expect(r.files.map((f) => f.name)).toEqual(['2.mp3', '10.mp3', '01.mp3', 'cover.jpg', '01.mp3'])
    expect(r.files[3].type).toBe('image/jpeg')
    expect(r.skipped).toEqual(['notes.txt'])
    expect(r.failed).toEqual([])
    expect(progress.at(-1)).toBe(1)
  })

  it('names the folder everything sits in', async () => {
    const zip = asFile(zipSync({ 'My Book/01.mp3': bytes(10, 12), 'My Book/02.mp3': bytes(10, 13) }))
    expect((await unzipFiles([zip], { keep })).folderName).toBe('My Book')
  })

  it('reports an archive it cannot read instead of throwing', async () => {
    const r = await unzipFiles([asFile(bytes(50, 14), 'broken.zip')], { keep })
    expect(r.files).toEqual([])
    expect(r.failed).toEqual([{ name: 'broken.zip', reason: 'not a ZIP archive' }])
  })
})

/** A ZIP64 archive as written by tools that always use it: sizes and offsets in the extra field and a ZIP64 end record. */
function zip64WithOneStoredEntry(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name)
  const parts: Uint8Array[] = []
  const le = (n: number, width: 2 | 4 | 8) => {
    const b = new Uint8Array(width)
    const v = new DataView(b.buffer)
    if (width === 2) v.setUint16(0, n, true)
    else if (width === 4) v.setUint32(0, n, true)
    else v.setBigUint64(0, BigInt(n), true)
    return b
  }
  const cat = (...xs: Uint8Array[]) => {
    const out = new Uint8Array(xs.reduce((a, x) => a + x.length, 0))
    let o = 0
    for (const x of xs) { out.set(x, o); o += x.length }
    return out
  }
  const extra = cat(le(0x0001, 2), le(24, 2), le(data.length, 8), le(data.length, 8), le(0, 8))
  const local = cat(le(0x04034b50, 4), le(45, 2), le(0x800, 2), le(0, 2), le(0, 4), le(0, 4), le(0xffffffff, 4), le(0xffffffff, 4), le(nameBytes.length, 2), le(extra.length - 8, 2), nameBytes, extra.subarray(0, 20))
  parts.push(local, data)
  const cdOffset = local.length + data.length
  const central = cat(le(0x02014b50, 4), le(45, 2), le(45, 2), le(0x800, 2), le(0, 2), le(0, 4), le(0, 4), le(0xffffffff, 4), le(0xffffffff, 4), le(nameBytes.length, 2), le(extra.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(0xffffffff, 4), nameBytes, extra)
  parts.push(central)
  const recOffset = cdOffset + central.length
  parts.push(cat(le(0x06064b50, 4), le(44, 8), le(45, 2), le(45, 2), le(0, 4), le(0, 4), le(1, 8), le(1, 8), le(central.length, 8), le(cdOffset, 8)))
  parts.push(cat(le(0x07064b50, 4), le(0, 4), le(recOffset, 8), le(1, 4)))
  parts.push(cat(le(0x06054b50, 4), le(0, 2), le(0, 2), le(0xffff, 2), le(0xffff, 2), le(0xffffffff, 4), le(0xffffffff, 4), le(0, 2)))
  return cat(...parts)
}
