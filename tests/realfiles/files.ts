/**
 * The owner's own audiobooks, for testing every tool on real files. They're
 * copyrighted, so they live outside the repo (REAL_FILES_DIR, default
 * ~/Programming/mp3tom4b_test_files) and the suite skips itself when the
 * folder isn't there. Files are opened lazily: nothing is read until a tool
 * reads it.
 */
import { existsSync, openAsBlob, readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseBlob } from 'music-metadata'
import { orderBy } from 'natural-orderby'
import { expect } from 'vitest'
import { fileNameToChapterTitle } from '@/lib/audio/format'
import { extractMetadata } from '@/lib/audio/metadata'
import { readMoov, readMp4Chapters, type Chapter } from '@/lib/audio/mp4Chapters'
import { decodedAudioSeconds } from '@/lib/ffmpeg/mp4Duration'
import type { AudioFile, ConversionMetadata } from '@/types'
import { NodeFFmpeg } from '../integration/nodeFFmpeg'

export const ROOT = process.env.REAL_FILES_DIR ?? path.join(os.homedir(), 'Programming/mp3tom4b_test_files')
export const HAVE_FILES = existsSync(ROOT)
/** REAL_FULL=1: whole books instead of a few chapters (about an hour). */
export const FULL = process.env.REAL_FULL === '1'

export const BOOKS = {
  /** 37 MP3s, 44.1 kHz stereo 64 kbps, chapter titles in the tags. */
  goblet: 'Harry potter and the goblet of fire',
  /** 38 MP3s, 22 kHz mono 32 kbps, no title tags, track tags out of order. */
  phoenix: 'Harry Potter and the order of the Phoenix',
}
/** 26 h 40 min, 40 chapters, 1.5 GB. */
export const PHOENIX_M4B = `${BOOKS.goblet}/J.K. Rowling - Harry Potter and the Order of the Phoenix.m4b`
/** 9 h 37 min, 20 chapters, 551 MB. */
export const CHAMBER_M4B = 'Harry potter and the chamber of secrets/Harry Potter and the Chamber of Secrets (Full-Cast Edition).m4b'
/** One 11 h 32 min MP3, 665 MB, with a PNG cover. */
export const AZKABAN_MP3 = `${BOOKS.phoenix}/J.K. Rowling - MP3 Harry Potter and the Prisoner of Azkaban (Full-Cast Edition).mp3`
export const ZIPS = {
  /** 37 entries: Goblet chapters + the Phoenix M4B. */
  one: 'drive-download-20261026T102102Z-1-001.zip',
  /** 2 entries: Goblet chapter 16 + the Chamber M4B. */
  two: 'drive-download-20261026T102102Z-1-002.zip',
  /** 40 entries: the Phoenix chapters, the Azkaban MP3 and its cover. */
  three: 'drive-download-20261026T102124Z-1-001.zip',
}

/** A file from the folder, read from disk only as it's used. */
export async function realFile(rel: string): Promise<File> {
  return new File([await openAsBlob(path.join(ROOT, rel))], path.basename(rel))
}

/** A book's chapter MP3s (the stray single-file book left out), in name order. */
export function chapterMp3s(dir: string): string[] {
  const names = readdirSync(path.join(ROOT, dir)).filter((n) => /\.mp3$/i.test(n) && !/Prisoner/.test(n))
  return orderBy(names, [(n) => n]).map((n) => `${dir}/${n}`)
}

/**
 * The AudioFiles the drop zone would build: natural filename order, and the
 * embedded title when it's unique across the drop, else the filename.
 */
export async function asDropped(files: File[]): Promise<AudioFile[]> {
  const sorted = orderBy(files, [(f) => f.name])
  const tags = await Promise.all(sorted.map((f) => extractMetadata(f)))
  const counts = new Map<string, number>()
  for (const t of tags) {
    const k = t.chapterTitle?.trim().toLowerCase()
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return sorted.map((file, i) => {
    const t = tags[i]
    const tag = t.chapterTitle?.trim()
    const title = tag && counts.get(tag.toLowerCase()) === 1 ? tag : fileNameToChapterTitle(file.name)
    return {
      id: String(i),
      file,
      chapterTitle: title,
      originalChapterTitle: title,
      duration: t.durationMs != null ? t.durationMs / 1000 : null,
      sourceBitrateKbps: t.sourceBitrateKbps,
      sourceLossless: t.sourceLossless,
      sourceSampleRate: t.sourceSampleRate,
      sourceChannels: t.sourceChannels,
      sourceCodec: t.sourceCodec,
    }
  })
}

export const META: ConversionMetadata = { title: 'Real File Test', author: 'Test Author', narrator: '', year: '', genre: 'Audiobook' }

export interface BookInfo {
  seconds: number
  chapters: Chapter[]
  codec?: string
  title?: string
}

/** What a player sees in an M4B: decoded length, chapters, codec, title. */
export async function bookInfo(m4b: Blob): Promise<BookInfo> {
  const moov = await readMoov(m4b)
  const { format, common } = await parseBlob(m4b, { duration: false })
  return {
    seconds: moov ? decodedAudioSeconds(moov) ?? NaN : NaN,
    chapters: await readMp4Chapters(m4b),
    codec: format.codec,
    title: common.title,
  }
}

let tools: Promise<NodeFFmpeg> | null = null

/**
 * ffmpeg's description of the audio stream, e.g. "aac (LC) …, 22050 Hz, mono".
 * The MP4 header's own channel count says 2 for mono AAC, so ask the decoder.
 */
export async function audioStream(m4b: Blob): Promise<string> {
  const ff = await (tools ??= NodeFFmpeg.create())
  await ff.writeFile('probe.m4b', new Uint8Array(await m4b.arrayBuffer()))
  const { log } = await ff.run(['-i', 'probe.m4b'])
  await ff.deleteFile('probe.m4b')
  return (log.find((l) => /Audio:/.test(l)) ?? '').replace(/.*Audio:\s*/, '').trim()
}

/**
 * Every source became one chapter, in order, with its title, and each chapter
 * lasts as long as its source. "As long as" within 1%: the durations come from
 * the tags, and for the 22 kHz MPEG-2 rips music-metadata reads ~0.5% short of
 * what ffmpeg decodes (2460.3 vs 2472.3 s), while the chapters follow the
 * decoded length.
 */
export function expectChaptersMatchSources(book: BookInfo, files: AudioFile[]) {
  expect(book.chapters.map((c) => c.title)).toEqual(files.map((f) => f.chapterTitle))
  const near = (actual: number, expected: number, what: string) =>
    expect(Math.abs(actual - expected), `${what}: ${actual.toFixed(1)} s vs ${expected.toFixed(1)} s`).toBeLessThan(expected * 0.01 + 1)
  near(book.seconds, files.reduce((a, f) => a + (f.duration ?? 0), 0), 'total length')
  book.chapters.forEach((c, i) => {
    const end = book.chapters[i + 1]?.startSec ?? book.seconds
    near(end - c.startSec, files[i].duration ?? 0, `chapter ${i + 1}`)
  })
}
