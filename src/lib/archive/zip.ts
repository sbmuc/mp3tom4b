/**
 * Unpacking ZIP archives dropped into the page, without holding them in
 * memory: the central directory is read from the end of the file, each entry
 * is a slice of the archive, and deflated entries are inflated by the
 * browser's own DecompressionStream. Everything stays on the device.
 */

export interface ZipEntry {
  /** Full path inside the archive, e.g. "Book/CD1/01 Intro.mp3". */
  path: string
  /** Last path segment, e.g. "01 Intro.mp3". */
  name: string
  /** 0 = stored, 8 = deflate. */
  method: number
  compressedSize: number
  size: number
  localHeaderOffset: number
  encrypted: boolean
}

const EOCD_SIG = 0x06054b50
const ZIP64_LOCATOR_SIG = 0x07064b50
const ZIP64_EOCD_SIG = 0x06064b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50
const MAX_COMMENT = 0xffff

async function read(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer())
}

const u64 = (v: DataView, at: number) => Number(v.getBigUint64(at, true))

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (!utf8Flag) {
    try {
      // Most tools write UTF-8 without setting the flag; fall back to Latin-1
      // (close to the old DOS code page) only when it isn't valid UTF-8.
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('latin1').decode(bytes)
    }
  }
  return new TextDecoder().decode(bytes)
}

/** Every file entry in the archive (directories left out), in archive order. */
export async function readZipEntries(zip: Blob): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, zip.size - (22 + MAX_COMMENT))
  const tail = await read(zip, tailStart, zip.size)
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive')

  let count = tail.getUint16(eocd + 10, true)
  let cdSize = tail.getUint32(eocd + 12, true)
  let cdOffset = tail.getUint32(eocd + 16, true)

  // ZIP64: the real values live in a separate record the locator points to.
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const locAt = tailStart + eocd - 20
    const loc = await read(zip, locAt, locAt + 20)
    if (loc.getUint32(0, true) !== ZIP64_LOCATOR_SIG) throw new Error('ZIP64 record missing')
    const recAt = u64(loc, 8)
    const rec = await read(zip, recAt, recAt + 56)
    if (rec.getUint32(0, true) !== ZIP64_EOCD_SIG) throw new Error('ZIP64 record missing')
    count = u64(rec, 32)
    cdSize = u64(rec, 40)
    cdOffset = u64(rec, 48)
  }

  const cd = await read(zip, cdOffset, cdOffset + cdSize)
  const bytes = new Uint8Array(cd.buffer)
  const entries: ZipEntry[] = []
  let at = 0
  for (let n = 0; n < count; n++) {
    if (at + 46 > cd.byteLength || cd.getUint32(at, true) !== CENTRAL_SIG) throw new Error('damaged ZIP directory')
    const flags = cd.getUint16(at + 8, true)
    const method = cd.getUint16(at + 10, true)
    let compressedSize = cd.getUint32(at + 20, true)
    let size = cd.getUint32(at + 24, true)
    const nameLen = cd.getUint16(at + 28, true)
    const extraLen = cd.getUint16(at + 30, true)
    const commentLen = cd.getUint16(at + 32, true)
    let localHeaderOffset = cd.getUint32(at + 42, true)
    const path = decodeName(bytes.subarray(at + 46, at + 46 + nameLen), (flags & 0x800) !== 0)

    // ZIP64 extra field: only the values that overflowed are present, in order.
    let x = at + 46 + nameLen
    const extraEnd = x + extraLen
    while (x + 4 <= extraEnd) {
      const id = cd.getUint16(x, true)
      const len = cd.getUint16(x + 2, true)
      if (id === 0x0001) {
        let f = x + 4
        if (size === 0xffffffff) { size = u64(cd, f); f += 8 }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cd, f); f += 8 }
        if (localHeaderOffset === 0xffffffff) { localHeaderOffset = u64(cd, f); f += 8 }
      }
      x += 4 + len
    }

    if (!path.endsWith('/')) {
      entries.push({
        path,
        name: path.slice(path.lastIndexOf('/') + 1),
        method,
        compressedSize,
        size,
        localHeaderOffset,
        encrypted: (flags & 0x1) !== 0,
      })
    }
    at += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** macOS resource forks, hidden files and the like: never what the user meant. */
export function isJunkEntry(e: Pick<ZipEntry, 'path' | 'name'>): boolean {
  return (
    e.path.startsWith('__MACOSX/') ||
    e.path.includes('/__MACOSX/') ||
    e.name.startsWith('.') ||
    /^(thumbs\.db|desktop\.ini)$/i.test(e.name)
  )
}

/**
 * One entry's contents. A stored entry is a slice of the archive (no copy); a
 * deflated one is inflated as a stream into a Blob the browser manages.
 */
export async function entryBlob(zip: Blob, e: ZipEntry, type = ''): Promise<Blob> {
  if (e.encrypted) throw new Error('password-protected')
  const local = await read(zip, e.localHeaderOffset, e.localHeaderOffset + 30)
  if (local.getUint32(0, true) !== LOCAL_SIG) throw new Error('damaged ZIP entry')
  const dataStart = e.localHeaderOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true)
  const raw = zip.slice(dataStart, dataStart + e.compressedSize)

  let out: Blob
  if (e.method === 0) out = raw
  else if (e.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack ZIP files')
    out = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()
  } else throw new Error(`unsupported compression (method ${e.method})`)

  if (out.size !== e.size) throw new Error('damaged ZIP entry')
  return new Blob([out], { type })
}

export interface UnzipResult {
  /** The kept entries as Files, named by their last path segment. */
  files: File[]
  /** Entries left out because `keep` said no, by name. */
  skipped: string[]
  /** Archives that couldn't be read, with why. */
  failed: { name: string; reason: string }[]
  /** The single top-level folder all entries of an archive sit in, if any. */
  folderName: string | null
}

/**
 * Unpack the entries `keep` wants from each archive, one entry at a time.
 * Junk entries (see isJunkEntry) are dropped silently; other unwanted ones are
 * listed in `skipped`. Entries come back in path order, so "CD1/…" stays
 * ahead of "CD2/…".
 */
export async function unzipFiles(
  zips: File[],
  o: {
    keep: (name: string) => boolean
    typeOf?: (name: string) => string
    onProgress?: (doneBytes: number, totalBytes: number) => void
  },
): Promise<UnzipResult> {
  const result: UnzipResult = { files: [], skipped: [], failed: [], folderName: null }
  const plans: { zip: File; entries: ZipEntry[] }[] = []
  for (const zip of zips) {
    try {
      const all = (await readZipEntries(zip)).filter((e) => !isJunkEntry(e))
      const wanted = all.filter((e) => o.keep(e.name))
      result.skipped.push(...all.filter((e) => !o.keep(e.name)).map((e) => e.name))
      if (wanted.some((e) => e.encrypted)) throw new Error('password-protected')
      wanted.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }))
      plans.push({ zip, entries: wanted })
      if (zips.length === 1) {
        const tops = new Set(all.map((e) => (e.path.includes('/') ? e.path.slice(0, e.path.indexOf('/')) : '')))
        const [top] = Array.from(tops)
        if (tops.size === 1 && top) result.folderName = top
      }
    } catch (err) {
      result.failed.push({ name: zip.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  const total = plans.reduce((a, p) => a + p.entries.reduce((b, e) => b + e.compressedSize, 0), 0)
  let done = 0
  for (const { zip, entries } of plans) {
    for (const e of entries) {
      try {
        const blob = await entryBlob(zip, e, o.typeOf?.(e.name) ?? '')
        result.files.push(new File([blob], e.name, { type: blob.type }))
      } catch (err) {
        result.failed.push({ name: `${zip.name}: ${e.name}`, reason: err instanceof Error ? err.message : String(err) })
      }
      done += e.compressedSize
      o.onProgress?.(done, total)
    }
  }
  return result
}

export function isZipFile(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed'
}

const TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** MIME type for an unpacked audio or image file, from its extension. */
export function guessType(name: string): string {
  return TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? ''
}
