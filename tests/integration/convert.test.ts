// @vitest-environment node
/**
 * End-to-end check of the homepage converter: real convertToM4B, real
 * ffmpeg-core, real music-metadata — only the browser worker is swapped for an
 * in-process core (nodeFFmpeg.ts). Each chapter is a pure tone, so the output
 * can be checked for decode errors, pitch per chapter, and where the chapter
 * markers sit relative to the audio. On macOS the result is also decoded by
 * Apple's own decoder (afconvert), which is stricter than ffmpeg's and is what
 * Apple Books uses.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { AudioFile, Bitrate, ConversionMetadata } from '@/types'

vi.mock('@/lib/ffmpeg/client', async () => (await import('./nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))

import { convertToM4B } from '@/lib/ffmpeg/convert'
import { extractMetadata } from '@/lib/audio/metadata'
import { NodeFFmpeg } from './nodeFFmpeg'

let tools: NodeFFmpeg
let tmp: string
const hasAfconvert = process.platform === 'darwin' && existsSync('/usr/bin/afconvert')

beforeAll(async () => {
  tools = await NodeFFmpeg.create()
  tmp = mkdtempSync(path.join(tmpdir(), 'mp3tom4b-it-'))
})
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

// ---- inputs --------------------------------------------------------------

interface ToneSpec {
  hz: number
  sec: number
  rate: number
  channels: 1 | 2
  format: 'mp3' | 'wav' | 'm4a'
  kbps?: number
}

let seq = 0
async function toneFile(t: ToneSpec): Promise<File> {
  const name = `tone_${seq++}.${t.format}`
  const codec =
    t.format === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', `${t.kbps ?? 128}k`]
    : t.format === 'm4a' ? ['-c:a', 'aac', '-b:a', `${t.kbps ?? 64}k`]
    : ['-c:a', 'pcm_s16le']
  const r = await tools.run([
    '-f', 'lavfi', '-i', `sine=frequency=${t.hz}:duration=${t.sec}:sample_rate=${t.rate}`,
    '-ac', String(t.channels), ...codec, name,
  ])
  expect(r.ret).toBe(0)
  const bytes = await tools.readFile(name)
  await tools.deleteFile(name)
  return new File([new Uint8Array(bytes)], `Chapter ${seq} - ${t.hz} Hz.${t.format}`)
}

/** Build the AudioFile the drop zone would, using the real tag reader. */
async function asAudioFile(file: File, i: number): Promise<AudioFile> {
  const x = await extractMetadata(file)
  const title = `Chapter ${i + 1}`
  return {
    id: String(i),
    file,
    chapterTitle: title,
    originalChapterTitle: title,
    duration: x.durationMs != null ? x.durationMs / 1000 : null,
    sourceBitrateKbps: x.sourceBitrateKbps,
    sourceLossless: x.sourceLossless,
    sourceSampleRate: x.sourceSampleRate,
    sourceChannels: x.sourceChannels,
    sourceCodec: x.sourceCodec,
  }
}

const META: ConversionMetadata = { title: 'Test Book', author: 'Test Author', narrator: '', year: '2026', genre: 'Audiobook' }

async function convert(specs: ToneSpec[], opts: { bitrate?: Bitrate; metadata?: Partial<ConversionMetadata> } = {}) {
  const files = await Promise.all(specs.map(async (s, i) => asAudioFile(await toneFile(s), i)))
  const labels: string[] = []
  const blob = await convertToM4B({
    files,
    metadata: { ...META, ...opts.metadata },
    coverFile: null,
    bitrate: opts.bitrate ?? 64,
    onProgress: (p) => labels.push(p.label),
  })
  return { out: new Uint8Array(await blob.arrayBuffer()), labels, files }
}

// ---- analysis ------------------------------------------------------------

interface Analysis {
  decodeErrors: string[]
  pcm: Int16Array
  rate: number
  stream: string
  chapters: Array<{ startMs: number; endMs: number; title: string }>
  tags: Record<string, string>
}

const unescape = (v: string) => v.replace(/\\([\s\S])/g, '$1')

async function analyze(m4b: Uint8Array): Promise<Analysis> {
  await tools.writeFile('out.m4b', m4b)
  const dec = await tools.run(['-v', 'error', '-i', 'out.m4b', '-f', 'null', '-'])
  const probe = await tools.run(['-i', 'out.m4b'])
  const stream = probe.log.find((l) => /Stream #\d+:\d+.*Audio:/.test(l)) ?? ''
  const rate = Number(stream.match(/(\d+) Hz/)?.[1])
  await tools.run(['-i', 'out.m4b', '-map', '0:a', '-f', 's16le', '-ac', '1', 'out.pcm'])
  const raw = await tools.readFile('out.pcm')
  const pcm = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
  await tools.run(['-i', 'out.m4b', '-f', 'ffmetadata', 'meta.txt'])
  const meta = new TextDecoder().decode(await tools.readFile('meta.txt'))
  for (const f of ['out.m4b', 'out.pcm', 'meta.txt']) await tools.deleteFile(f)

  const [head, ...blocks] = meta.split('[CHAPTER]')
  const tags: Record<string, string> = {}
  for (const line of head.split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/)
    if (m) tags[m[1]] = unescape(m[2])
  }
  const chapters = blocks.map((b) => {
    const num = (k: string) => Number(b.match(new RegExp(`^${k}=(\\d+)`, 'm'))?.[1])
    const scale = b.match(/^TIMEBASE=(\d+)\/(\d+)/m)
    const toMs = (v: number) => (scale ? (v * Number(scale[1]) * 1000) / Number(scale[2]) : v)
    return { startMs: toMs(num('START')), endMs: toMs(num('END')), title: unescape(b.match(/^title=(.*)$/m)?.[1] ?? '') }
  })
  // 'Aborted()' is emscripten's normal end-of-run line, not a decode error
  const decodeErrors = dec.log.filter((l) => l.trim() && l.trim() !== 'Aborted()')
  return { decodeErrors, pcm, rate, stream, chapters, tags }
}

/** Frequency from zero crossings — exact enough for a pure tone. */
function toneHz(a: Analysis, fromMs: number, toMs: number): number {
  const s = Math.round((fromMs / 1000) * a.rate)
  const e = Math.min(a.pcm.length, Math.round((toMs / 1000) * a.rate))
  let crossings = 0
  for (let i = s + 1; i < e; i++) if ((a.pcm[i - 1] < 0) !== (a.pcm[i] < 0)) crossings++
  return crossings / 2 / ((e - s) / a.rate)
}

function goertzel(a: Analysis, s: number, n: number, hz: number): number {
  const k = 2 * Math.cos((2 * Math.PI * hz) / a.rate)
  let p = 0
  let q = 0
  for (let i = s; i < s + n && i < a.pcm.length; i++) {
    const c = a.pcm[i] + k * p - q
    q = p
    p = c
  }
  return p * p + q * q - k * p * q
}

/**
 * Where tone `next` takes over from `prev`, searched ±600 ms around `nearMs`.
 * Between parts sits ~20–40 ms of encoder priming/padding silence, where noise
 * alone can tip the ratio — so `next` must also be at a real level: at least a
 * quarter of its steady-state energy, measured 200 ms into the chapter.
 */
function onsetMs(a: Analysis, prev: number, next: number, nearMs: number): number | null {
  const n = Math.round(a.rate * 0.005)
  const steady = goertzel(a, Math.round(((nearMs + 200) / 1000) * a.rate), n, next)
  const from = Math.max(0, Math.round(((nearMs - 600) / 1000) * a.rate))
  const to = Math.round(((nearMs + 600) / 1000) * a.rate)
  for (let s = from; s + n <= Math.min(to, a.pcm.length); s += n) {
    const e = goertzel(a, s, n, next)
    if (e > steady * 0.25 && e > goertzel(a, s, n, prev) * 4) return (s / a.rate) * 1000
  }
  return null
}

/** Every chapter plays its own tone at the right pitch, and every marker sits on the audio. */
function expectChaptersMatchAudio(a: Analysis, specs: ToneSpec[]) {
  expect(a.chapters).toHaveLength(specs.length)
  specs.forEach((t, i) => {
    const { startMs, endMs } = a.chapters[i]
    expect(toneHz(a, startMs + 80, endMs - 80), `pitch of chapter ${i + 1}`).toBeGreaterThan(t.hz * 0.985)
    expect(toneHz(a, startMs + 80, endMs - 80), `pitch of chapter ${i + 1}`).toBeLessThan(t.hz * 1.015)
    if (i > 0) {
      const onset = onsetMs(a, specs[i - 1].hz, t.hz, startMs)
      expect(onset, `onset of chapter ${i + 1}`).not.toBeNull()
      // the marker may sit up to ~one AAC frame (+ detector window) before the
      // first sound; it must never drift past it or accumulate
      expect(onset! - startMs, `marker → audio offset, chapter ${i + 1}`).toBeGreaterThan(-10)
      expect(onset! - startMs, `marker → audio offset, chapter ${i + 1}`).toBeLessThan(45)
    }
  })
}

/** Apple's decoder (Apple Books / QuickTime) must read the whole file. */
function expectAppleDecodes(m4b: Uint8Array, expectedSec: number) {
  if (!hasAfconvert) return
  const inPath = path.join(tmp, `apple_${seq++}.m4b`)
  const outPath = inPath.replace(/\.m4b$/, '.caf')
  writeFileSync(inPath, m4b)
  execFileSync('/usr/bin/afconvert', [inPath, '-o', outPath, '-f', 'caff', '-d', 'LEI16'], { stdio: 'pipe' })
  const info = execFileSync('/usr/bin/afinfo', [outPath]).toString()
  const sec = Number(info.match(/estimated duration: ([\d.]+) sec/)?.[1])
  expect(sec).toBeGreaterThan(expectedSec - 0.1)
  expect(sec).toBeLessThan(expectedSec + 0.5)
  readFileSync(outPath) // exists
}

const total = (specs: ToneSpec[]) => specs.reduce((a, t) => a + t.sec, 0)

// ---- cases ---------------------------------------------------------------

const mp3 = (hz: number, rate = 44100, channels: 1 | 2 = 2, sec = 3): ToneSpec => ({ hz, sec, rate, channels, format: 'mp3' })

describe('convertToM4B — joining different sources', () => {
  it('uniform MP3s (one rip, one encoder)', async () => {
    const specs = [mp3(440), mp3(880), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expect(a.stream).toMatch(/44100 Hz, stereo/)
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('one chapter at 48 kHz among 44.1 kHz — no pitch shift', async () => {
    const specs = [mp3(440), mp3(880, 48000), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expect(a.stream).toMatch(/48000 Hz, stereo/)
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('one mono chapter among stereo — Apple can still read it', async () => {
    const specs = [mp3(440), mp3(880, 44100, 1), mp3(660)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('old rip mixed with a new one: 22 kHz mono + 44.1 kHz stereo, MP3 + WAV', async () => {
    const specs: ToneSpec[] = [mp3(440, 22050, 1), { hz: 880, sec: 3, rate: 44100, channels: 2, format: 'wav' }, mp3(660, 22050, 1)]
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('an all-mono set stays mono', async () => {
    const specs = [mp3(440, 22050, 1), mp3(880, 22050, 1)]
    const a = await analyze((await convert(specs)).out)
    expect(a.stream).toMatch(/22050 Hz, mono/)
  })
})

describe('convertToM4B — chapter markers', () => {
  it('stay on the audio across 10 chapters of odd lengths (no drift)', async () => {
    const lengths = [3.3, 4.7, 2.1, 5.9, 3.05, 4.44, 2.77, 3.9, 5.2, 2.6]
    const specs = lengths.map((sec, i) => mp3(300 + i * 200, 44100, 2, sec))
    const { out } = await convert(specs)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expect(a.chapters.map((c) => c.title)).toEqual(lengths.map((_, i) => `Chapter ${i + 1}`))
    expectAppleDecodes(out, total(specs))
  })
})

describe('convertToM4B — metadata', () => {
  it('keeps a backslash, semicolon and equals sign in the book title', async () => {
    const { out } = await convert([mp3(440, 44100, 2, 1)], {
      metadata: { title: 'AC\\DC Live; Part=1', author: 'Guns N\' Roses #1', narrator: 'A \\ B' },
    })
    const a = await analyze(out)
    expect(a.tags.title).toBe('AC\\DC Live; Part=1')
    expect(a.tags.album).toBe('AC\\DC Live; Part=1')
    expect(a.tags.artist).toBe('Guns N\' Roses #1')
    expect(a.tags.composer).toBe('A \\ B')
  })
})

describe('convertToM4B — AAC .m4a inputs', () => {
  const m4a = (hz: number, kbps: number, channels: 1 | 2 = 2): ToneSpec => ({ hz, sec: 3, rate: 44100, channels, format: 'm4a', kbps })

  it('copies matching AAC at the chosen bitrate instead of re-encoding', async () => {
    const specs = [m4a(440, 64), m4a(880, 64), m4a(660, 64)]
    const { out, labels } = await convert(specs, { bitrate: 64 })
    expect(labels.some((l) => l.startsWith('Copying chapters'))).toBe(true)
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(false)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('re-encodes mono + stereo AAC even though the tags claim both are stereo', async () => {
    const specs = [m4a(440, 64), m4a(880, 64, 1), m4a(660, 64)]
    const { out, labels, files } = await convert(specs, { bitrate: 64 })
    expect(files[1].sourceChannels).toBe(2) // the music-metadata quirk this guards against
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(true)
    const a = await analyze(out)
    expect(a.decodeErrors).toEqual([])
    expectChaptersMatchAudio(a, specs)
    expectAppleDecodes(out, total(specs))
  })

  it('re-encodes AAC above the chosen bitrate, so the size estimate holds', async () => {
    const specs = [m4a(440, 160), m4a(880, 160)]
    const { out, labels } = await convert(specs, { bitrate: 64 })
    expect(labels.some((l) => l.startsWith('Encoding chapters'))).toBe(true)
    // 6 s at 64 kbps ≈ 48 KB of audio; the 160 kbps sources are ~120 KB
    expect(out.byteLength).toBeLessThan(75_000)
  })
})
