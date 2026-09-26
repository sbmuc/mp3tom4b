/**
 * Shared checks for the integration tests. Every chapter in a test input is a
 * pure tone, so an output can be checked for decode errors, pitch per chapter,
 * and where each chapter marker sits relative to the audio. On macOS the result
 * is also decoded by Apple's own decoder (afconvert), which is stricter than
 * ffmpeg's and is what Apple Books uses.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect } from 'vitest'
import type { AudioFile, ConversionMetadata } from '@/types'
import { extractMetadata } from '@/lib/audio/metadata'
import { NodeFFmpeg } from './nodeFFmpeg'

let toolsPromise: Promise<NodeFFmpeg> | null = null
/** A core instance of its own for making inputs and analysing outputs. */
const getTools = () => (toolsPromise ??= NodeFFmpeg.create())
const tmp = mkdtempSync(path.join(tmpdir(), 'mp3tom4b-it-'))
const hasAfconvert = process.platform === 'darwin' && existsSync('/usr/bin/afconvert')

// ---- inputs --------------------------------------------------------------

export interface ToneSpec {
  hz: number
  sec: number
  rate: number
  channels: 1 | 2
  format: 'mp3' | 'wav' | 'm4a'
  kbps?: number
}

export const mp3 = (hz: number, rate = 44100, channels: 1 | 2 = 2, sec = 3): ToneSpec => ({ hz, sec, rate, channels, format: 'mp3' })

/** Ten chapters of odd lengths — enough for any per-chapter drift to add up. */
export const TEN_ODD_CHAPTERS: ToneSpec[] = [3.3, 4.7, 2.1, 5.9, 3.05, 4.44, 2.77, 3.9, 5.2, 2.6].map((sec, i) =>
  mp3(300 + i * 200, 44100, 2, sec),
)

const codecArgs = (t: Pick<ToneSpec, 'format' | 'kbps'>) =>
  t.format === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', `${t.kbps ?? 128}k`]
  : t.format === 'm4a' ? ['-c:a', 'aac', '-b:a', `${t.kbps ?? 64}k`]
  : ['-c:a', 'pcm_s16le']

let seq = 0
async function render(args: string[], ext: string, displayName: string): Promise<File> {
  const tools = await getTools()
  const name = `in_${seq++}.${ext}`
  const r = await tools.run([...args, name])
  expect(r.ret).toBe(0)
  const bytes = await tools.readFile(name)
  await tools.deleteFile(name)
  return new File([new Uint8Array(bytes)], displayName)
}

/** One file per tone. */
export function toneFile(t: ToneSpec): Promise<File> {
  return render(
    ['-f', 'lavfi', '-i', `sine=frequency=${t.hz}:duration=${t.sec}:sample_rate=${t.rate}`, '-ac', String(t.channels), ...codecArgs(t)],
    t.format,
    `Chapter ${seq} - ${t.hz} Hz.${t.format}`,
  )
}

/** One long file that plays the tones back to back (same rate/layout for all). */
export function longToneFile(specs: ToneSpec[], format: ToneSpec['format'] = 'mp3'): Promise<File> {
  const inputs = specs.flatMap((t) => ['-f', 'lavfi', '-i', `sine=frequency=${t.hz}:duration=${t.sec}:sample_rate=${specs[0].rate}`])
  const concat = specs.map((_, i) => `[${i}:a]`).join('') + `concat=n=${specs.length}:v=0:a=1`
  return render([...inputs, '-filter_complex', concat, '-ac', String(specs[0].channels), ...codecArgs({ format })], format, `lecture.${format}`)
}

/** Build the AudioFile the drop zone would, using the real tag reader. */
export async function asAudioFile(file: File, i: number): Promise<AudioFile> {
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

export const META: ConversionMetadata = { title: 'Test Book', author: 'Test Author', narrator: '', year: '2026', genre: 'Audiobook' }

export const total = (specs: ToneSpec[]) => specs.reduce((a, t) => a + t.sec, 0)

// ---- analysis ------------------------------------------------------------

export interface Analysis {
  decodeErrors: string[]
  pcm: Int16Array
  rate: number
  stream: string
  chapters: Array<{ startMs: number; endMs: number; title: string }>
  tags: Record<string, string>
}

const unescape = (v: string) => v.replace(/\\([\s\S])/g, '$1')

export async function analyze(m4b: Uint8Array): Promise<Analysis> {
  const tools = await getTools()
  await tools.writeFile('out.m4b', m4b)
  const probe = await tools.run(['-i', 'out.m4b'])
  const stream = probe.log.find((l) => /Stream #\d+:\d+.*Audio:/.test(l)) ?? ''
  const rate = Number(stream.match(/(\d+) Hz/)?.[1])
  await tools.run(['-i', 'out.m4b', '-map', '0:a', '-f', 's16le', '-ac', '1', 'out.pcm'])
  const raw = await tools.readFile('out.pcm')
  const pcm = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
  await tools.run(['-i', 'out.m4b', '-f', 'ffmetadata', 'meta.txt'])
  const meta = new TextDecoder().decode(await tools.readFile('meta.txt'))
  const dec = await tools.run(['-v', 'error', '-i', 'out.m4b', '-f', 'null', '-'])
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
export function onsetMs(a: Analysis, prev: number, next: number, nearMs: number): number | null {
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

/**
 * Every chapter plays its own tone at the right pitch, and every marker sits on
 * the audio: never after the chapter's first sound, never drifting as chapters
 * go by, and at most `maxLeadMs` before it. The converter leads by about one AAC
 * priming frame (~23 ms). Tools that split an existing stream and re-encode the
 * pieces lead by more at each cut — priming, plus the piece's first frame
 * decoding as a fade-in (AAC) or not at all (MP3 frames borrow bits from the
 * previous one) — a fixed cost per cut, so they pass a larger `maxLeadMs`.
 */
export function expectChaptersMatchAudio(a: Analysis, specs: ToneSpec[], opts: { maxLeadMs?: number } = {}) {
  const maxLeadMs = opts.maxLeadMs ?? 45
  expect(a.chapters).toHaveLength(specs.length)
  const leads: number[] = []
  specs.forEach((t, i) => {
    const { startMs, endMs } = a.chapters[i]
    expect(toneHz(a, startMs + 150, endMs - 80), `pitch of chapter ${i + 1}`).toBeGreaterThan(t.hz * 0.985)
    expect(toneHz(a, startMs + 150, endMs - 80), `pitch of chapter ${i + 1}`).toBeLessThan(t.hz * 1.015)
    if (i > 0) {
      const onset = onsetMs(a, specs[i - 1].hz, t.hz, startMs)
      expect(onset, `onset of chapter ${i + 1}`).not.toBeNull()
      leads.push(onset! - startMs)
    }
  })
  leads.forEach((lead, k) => {
    expect(lead, `chapter ${k + 2}: marker must not come after the first sound`).toBeGreaterThan(-10)
    expect(lead, `chapter ${k + 2}: marker too far before the first sound`).toBeLessThan(maxLeadMs)
  })
  if (leads.length > 1) {
    expect(Math.max(...leads) - Math.min(...leads), `markers drift (leads: ${leads.map((l) => l.toFixed(0)).join(' ')} ms)`).toBeLessThan(60)
  }
}

/** Apple's decoder (Apple Books / QuickTime) must read the whole file. */
export function expectAppleDecodes(m4b: Uint8Array, expectedSec: number) {
  if (!hasAfconvert) return
  const inPath = path.join(tmp, `apple_${seq++}.m4b`)
  const outPath = inPath.replace(/\.m4b$/, '.caf')
  writeFileSync(inPath, m4b)
  execFileSync('/usr/bin/afconvert', [inPath, '-o', outPath, '-f', 'caff', '-d', 'LEI16'], { stdio: 'pipe' })
  const info = execFileSync('/usr/bin/afinfo', [outPath]).toString()
  const sec = Number(info.match(/estimated duration: ([\d.]+) sec/)?.[1])
  expect(sec).toBeGreaterThan(expectedSec - 0.1)
  expect(sec).toBeLessThan(expectedSec + 0.5)
  }


