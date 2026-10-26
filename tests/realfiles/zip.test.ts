/**
 * ZIP archives as Google Drive hands them out: deflated, split across parts,
 * books mixed between parts.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { entryBlob, readZipEntries, unzipFiles } from '@/lib/archive/zip'
import { BOOKS, FULL, HAVE_FILES, ZIPS, realFile } from './files'

const sha = async (b: Blob) => createHash('sha256').update(new Uint8Array(await b.arrayBuffer())).digest('hex')

describe.skipIf(!HAVE_FILES)('ZIP archives from Google Drive', () => {
  it('lists every entry of each part', async () => {
    const counts = await Promise.all(Object.values(ZIPS).map(async (z) => (await readZipEntries(await realFile(z))).length))
    expect(counts).toEqual([37, 2, 40])
  })

  it('unpacks a chapter byte-for-byte', async () => {
    const zip = await realFile(ZIPS.one)
    const entry = (await readZipEntries(zip)).find((e) => e.name === 'Chapter 02.mp3')!
    expect(await sha(await entryBlob(zip, entry))).toBe(await sha(await realFile(`${BOOKS.goblet}/Chapter 02.mp3`)))
  })

  it('takes only what the converter can use from a part, and says what it left', async () => {
    const r = await unzipFiles([await realFile(ZIPS.two)], { keep: (n) => /\.(mp3|jpe?g|png)$/i.test(n) })
    expect(r.files.map((f) => f.name)).toEqual(['Chapter 16.mp3'])
    expect(r.skipped).toEqual(['Harry Potter and the Chamber of Secrets (Full-Cast Edition).m4b'])
    expect(r.failed).toEqual([])
  })

  it('unpacks a cover image along with the audio', async () => {
    const r = await unzipFiles([await realFile(ZIPS.three)], { keep: (n) => /\.(jpe?g|png)$/i.test(n) })
    expect(r.files.map((f) => f.name)).toEqual(['J.K. Rowling - MP3 Harry Potter and the Prisoner of Azkaban (Full-Cast Edition).jpg'])
    expect(await sha(r.files[0])).toBe(await sha(await realFile(`${BOOKS.phoenix}/${r.files[0].name}`)))
  })

  it.runIf(FULL)('unpacks all three parts completely', async () => {
    const zips = await Promise.all(Object.values(ZIPS).map(realFile))
    const r = await unzipFiles(zips, { keep: () => true })
    expect(r.failed).toEqual([])
    expect(r.files).toHaveLength(79)
  })
})
