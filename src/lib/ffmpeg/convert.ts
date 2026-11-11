'use client'

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { AudioFile, Bitrate, ConversionMetadata, ConversionProgress, ShortChapter } from '@/types'
import { readMoov } from '@/lib/audio/mp4Chapters'
import { resizeCoverImage } from '@/lib/image/resize'
import { buildChapters, buildFFMetadata, buildGlobalMetadata } from './chapters'
import { createWorkerFFmpeg, ffmpegLoadingLabel, getFFmpeg, releaseWorkerFFmpeg } from './client'
import { loadEngine } from './engine'
import {
  audioStreamSignature,
  buildEncodeArgs,
  buildTimedConcatList,
  canCopyStreams,
  mayStreamCopy,
  pickEncodeTarget,
  type EncodeTarget,
} from './concatPlan'
import { OWN_COVER_ARGS } from './cover'
import { buildJobs, findShortChapters, pauseScanArgs, pickCuts, piecesPerFile, type EncodeJob } from './pieces'
import { parseSilences } from './chapterize'
import { humanizeFfmpegError } from './errors'
import { mountBlobs, ownedBytes, unmount } from './files'
import { decodedAudioSeconds } from './mp4Duration'
import { probeDurationMs } from './probe'
import { runFFmpeg } from './run'
import { MIN_MEASURED_MS } from '@/lib/format/eta'

// Mutex for the singleton FFmpeg instance. Concurrent calls into the same
// ffmpeg.wasm instance corrupt its wasm heap (manifests as
// "RuntimeError: memory access out of bounds"), even though the JS API queues
// messages. Parallel workers must serialize their writes to the singleton.
let singletonOpLock: Promise<void> = Promise.resolve()
async function withSingleton<T>(op: (ffmpeg: FFmpeg) => Promise<T>): Promise<T> {
  const previous = singletonOpLock
  let release!: () => void
  singletonOpLock = new Promise<void>((r) => {
    release = r
  })
  try {
    await previous
    const ffmpeg = await getFFmpeg()
    return await op(ffmpeg)
  } finally {
    release()
  }
}

export interface ConvertResult {
  blob: Blob
  /** Where each chapter starts in the M4B (ms), and its length: for a quick update. */
  starts: number[]
  durationMs: number
  /** Chapters much shorter than their files: part of the file couldn't be decoded. */
  shortChapters: ShortChapter[]
}

export interface ConvertOptions {
  files: AudioFile[]
  metadata: ConversionMetadata
  coverFile: File | null
  bitrate: Bitrate
  onProgress?: (p: ConversionProgress) => void
}

const inputName = (i: number, ext: string) => `input_${i}.${ext}`
const encodedName = (i: number) => `enc_${i}.m4a`
// Sources and encoded parts are mounted, never copied in (see files.ts).
const SOURCE_DIR = '/mnt_source' // in an encoder worker: the file it is encoding
const SCAN_DIR = '/mnt_scan' // on the singleton: a long file scanned for pauses
const PARTS_DIR = '/mnt_parts' // on the singleton: the AAC parts to join
const partPath = (i: number) => `${PARTS_DIR}/${encodedName(i)}`
const LIST_PATH = 'concat_list.txt'
const META_PATH = 'chapters.ffmeta'
const COVER_PATH = 'cover.jpg'
const OUTPUT_PATH = 'output.m4b'

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin'
}

// Takes the run's own instance: after a cancel it is terminated, and fetching
// "the" instance again would load a fresh one only to delete files that are
// already gone with the old one.
async function safeDelete(ffmpeg: FFmpeg, path: string) {
  try {
    await ffmpeg.deleteFile(path)
  } catch {
    // ignore
  }
}

/** How many workers to encode with. Scales with logical CPU count. */
function workerCount(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4
  // Leave half the cores for the OS + browser main thread.
  // Cap at 3 to keep memory pressure manageable.
  return Math.min(3, Math.max(1, Math.floor(cores / 2)))
}

/**
 * How much each file counts towards the encoding progress: its length, so the
 * bar (and the time left projected from it) moves with the audio done. A
 * 27-minute chapter and an 11-hour file used to count the same, which made
 * the estimate jump between minutes and an hour. A file of unknown length
 * counts as an average one. Pure + testable.
 */
export function encodeWeights(durationsSec: Array<number | null>): number[] {
  const known = durationsSec.filter((d): d is number => d != null && d > 0)
  const average = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 1
  return durationsSec.map((d) => (d != null && d > 0 ? d : average))
}

/**
 * Time left to encode: the files still being encoded and the queue played out
 * over the workers, each file going to whichever worker frees up first, at the
 * pace measured so far (ms per second of audio, per worker). Unlike a
 * straight projection it sees the tail coming: when one long file is left,
 * the other workers sit idle and the end takes longer. Pure + testable.
 */
export function simulateEncodeMs(o: {
  /** Time still needed by each file in progress (ms), one per busy worker. */
  activeMs: number[]
  /** Audio seconds of each file not started yet, in queue order. */
  queued: number[]
  workers: number
  msPerAudioSec: number
}): number {
  const freeAt = [...o.activeMs]
  while (freeAt.length < o.workers) freeAt.push(0)
  for (const sec of o.queued) {
    let next = 0
    for (let w = 1; w < freeAt.length; w++) if (freeAt[w] < freeAt[next]) next = w
    freeAt[next] += sec * o.msPerAudioSec
  }
  return Math.max(0, ...freeAt)
}

/**
 * Cut points for the long files: each file that piecesPerFile wants cut is
 * scanned for pauses (a decode pass, fast next to the encode), and cut in
 * the middle of the pauses nearest its even split points. Files with no
 * usable pause stay whole, as before.
 */
async function planCuts(
  files: AudioFile[],
  durationsSec: number[],
  workers: number,
  emit: (p: ConversionProgress) => void,
): Promise<number[][]> {
  const pieces = piecesPerFile(durationsSec, workers)
  const cuts: number[][] = files.map(() => [])
  const toScan = pieces.map((n, i) => (n > 1 ? i : -1)).filter((i) => i >= 0)
  for (const [k, i] of toScan.entries()) {
    const ext = fileExtension(files[i].file.name)
    const name = `scan_${i}.${ext}`
    const lines: string[] = []
    const totalMs = durationsSec[i] * 1000
    const onLog = ({ message }: { message: string }) => {
      lines.push(message)
      const ms = logTimeMs(message)
      if (ms != null && totalMs > 0) {
        const share = (k + Math.min(1, ms / totalMs)) / toScan.length
        emit({ status: 'probing', percent: 3 + Math.round(share * 7), label: 'Finding pauses to share the long file between workers…' })
      }
    }
    await withSingleton(async (ffmpeg) => {
      await mountBlobs(ffmpeg, SCAN_DIR, [{ name, data: files[i].file }])
      ffmpeg.on('log', onLog)
      try {
        // The scan writes nothing; a non-zero exit only means no usable pauses.
        await ffmpeg.exec(pauseScanArgs(`${SCAN_DIR}/${name}`))
      } catch {
        // a failed scan leaves the file whole
      } finally {
        ffmpeg.off('log', onLog)
        await unmount(ffmpeg, SCAN_DIR)
      }
    })
    cuts[i] = pickCuts(durationsSec[i], pieces[i], parseSilences(lines))
  }
  return cuts
}

const LOG_TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

/** ffmpeg's "time=H:MM:SS.cc" in a log line, in ms. */
function logTimeMs(message: string): number | null {
  const m = message.match(LOG_TIME_RE)
  if (!m) return null
  return ((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 100 + Number(m[4].padEnd(2, '0'))) * 10
}

/**
 * Encode the book's jobs (whole files, or pieces of long ones) to AAC on a
 * pool of worker instances, each taking the next job from a shared queue.
 * Every part is encoded to the same sample rate + channel count, so the parts
 * can be copy-joined. Returns the parts as Blobs, in job order, for the join
 * to mount, and each part's decoded length in seconds (null if unreadable).
 */
async function encodeJobsParallel(
  files: AudioFile[],
  jobs: EncodeJob[],
  workers: number,
  bitrate: Bitrate,
  target: EncodeTarget,
  emit: (p: ConversionProgress) => void,
): Promise<{ parts: Blob[]; decodedSec: Array<number | null> }> {
  const total = jobs.length
  const parts = new Array<Blob>(total)
  const decodedSec = new Array<number | null>(total).fill(null)
  // Per-job encode progress (0–1). Updated by whichever worker holds the job.
  const perJob = new Array<number>(total).fill(0)
  const weights = jobs.map((j) => j.weight)
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1
  // Jobs left per file: the label counts files (chapters), not pieces.
  const jobsLeft = files.map((_, i) => jobs.filter((j) => j.file === i).length)
  let filesDone = 0
  // When each job was picked up and finished, for the pace per worker.
  const startedAt = new Array<number | null>(total).fill(null)
  const finishedAt = new Array<number | null>(total).fill(null)
  // Longest first: a long file left to the end kept one worker busy while
  // the others sat idle. The parts still join in book order.
  const queue: number[] = Array.from({ length: total }, (_, i) => i).sort((a, b) => weights[b] - weights[a] || a - b)
  const concurrency = Math.min(workers, total)

  /** Time left, from the pace so far; undefined until there's enough to go on. */
  function remainingMs(): number | undefined {
    const now = Date.now()
    let busyMs = 0
    let doneSec = 0
    for (let i = 0; i < total; i++) {
      const start = startedAt[i]
      if (start == null) continue
      busyMs += (finishedAt[i] ?? now) - start
      doneSec += perJob[i] * weights[i]
    }
    if (busyMs < MIN_MEASURED_MS || doneSec <= 0) return undefined
    const msPerAudioSec = busyMs / doneSec
    // A job in progress goes at its own pace once it has shown one: files
    // differ a lot (22 kHz mono made into 44.1 kHz stereo took twice as long
    // per second of audio as a 44.1 kHz stereo file), so the common pace is
    // only for jobs not started yet.
    const activeMs: number[] = []
    for (let i = 0; i < total; i++) {
      const start = startedAt[i]
      if (start == null || finishedAt[i] != null) continue
      const p = perJob[i]
      const elapsed = now - start
      const ownPace = p >= 0.02 && elapsed >= MIN_MEASURED_MS ? elapsed / (p * weights[i]) : msPerAudioSec
      activeMs.push((1 - p) * weights[i] * ownPace)
    }
    return simulateEncodeMs({ activeMs, queued: queue.map((i) => weights[i]), workers: concurrency, msPerAudioSec })
  }

  function emitProgress() {
    const fraction = perJob.reduce((sum, p, i) => sum + p * weights[i], 0) / totalWeight
    emit({
      status: 'encoding',
      percent: Math.min(80, 10 + Math.round(fraction * 70)),
      label: `Encoding chapters… (${filesDone} of ${files.length} done)`,
      fraction,
      remainingMs: remainingMs(),
    })
  }

  async function runWorker() {
    const worker = await createWorkerFFmpeg()
    try {
      while (true) {
        const idx = queue.shift()
        if (idx === undefined) break
        startedAt[idx] = Date.now()

        const job = jobs[idx]
        const f = files[job.file]
        const ext = fileExtension(f.file.name)
        const inPath = inputName(job.file, ext)
        const outPath = encodedName(idx)

        // A piece's progress is its own output time over its own length;
        // ffmpeg's share is of the whole input, which a piece never fills.
        const onProgress = ({ progress, time }: { progress: number; time: number }) => {
          const share = job.trimmed ? time / 1_000_000 / Math.max(1, job.weight) : progress
          perJob[idx] = Math.max(0, Math.min(1, share))
          emitProgress()
        }
        worker.on('progress', onProgress)

        // Tag any failure with the chapter + step that crashed so the user
        // sees something more useful than a bare wasm error.
        const tagged = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
          try {
            return await fn()
          } catch (err) {
            const orig = err instanceof Error ? err.message : String(err)
            throw new Error(`${step} chapter ${job.file + 1}/${files.length}: ${orig || 'unknown wasm error'}`)
          }
        }

        try {
          await tagged('reading', () =>
            mountBlobs(worker, SOURCE_DIR, [{ name: inPath, data: f.file }]),
          )
          try {
            await tagged('encoding', () =>
              runFFmpeg(
                worker,
                buildEncodeArgs({
                  input: `${SOURCE_DIR}/${inPath}`,
                  output: outPath,
                  bitrate,
                  target,
                  trim: job.trimmed ? { startSec: job.startSec, endSec: job.endSec } : undefined,
                }),
              ),
            )
          } finally {
            await unmount(worker, SOURCE_DIR)
          }
          const bytes = await tagged('reading encoded output of', async () => ownedBytes(await worker.readFile(outPath)))
          decodedSec[idx] = decodedAudioSeconds(bytes)
          parts[idx] = new Blob([bytes], { type: 'audio/mp4' })
        } finally {
          worker.off('progress', onProgress)
          perJob[idx] = 1
          finishedAt[idx] = Date.now()
          if (--jobsLeft[job.file] === 0) filesDone++
          emitProgress()
          try { await worker.deleteFile(outPath) } catch { /* ignore */ }
        }
      }
    } finally {
      releaseWorkerFFmpeg(worker)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runWorker()))
  return { parts, decodedSec }
}

/** ffmpeg's one-line description of a file's audio stream (see concatPlan). */
async function probeStreamSignature(ffmpeg: FFmpeg, path: string): Promise<string | null> {
  const lines: string[] = []
  const onLog = ({ message }: { message: string }) => {
    lines.push(message)
  }
  ffmpeg.on('log', onLog)
  try {
    // No output file → ffmpeg exits non-zero after printing the header, which
    // is all we need. `-v info` explicitly: the log level persists across runs
    // on one instance, and the stream line is only printed at info.
    await ffmpeg.exec(['-hide_banner', '-v', 'info', '-i', path])
  } catch {
    // expected
  } finally {
    ffmpeg.off('log', onLog)
  }
  return audioStreamSignature(lines)
}

/**
 * Skip the re-encode for AAC .m4a inputs: the sources themselves are the
 * parts. Copy-joining is only safe when every part has the exact same codec
 * config, so each is probed; on any mismatch null tells the caller to
 * re-encode. Otherwise returns each part's decoded length in seconds.
 */
async function copyIfCompatible(
  files: AudioFile[],
  emit: (p: ConversionProgress) => void,
): Promise<Array<number | null> | null> {
  const decodedSec = new Array<number | null>(files.length).fill(null)
  const signatures = new Array<string | null>(files.length).fill(null)
  await mountParts(files.map((f) => f.file))
  for (let i = 0; i < files.length; i++) {
    // Only the moov box is read; the audio stays where it is.
    const moov = await readMoov(files[i].file)
    decodedSec[i] = moov ? decodedAudioSeconds(moov) : null
    signatures[i] = await withSingleton((mainFFmpeg) => probeStreamSignature(mainFFmpeg, partPath(i)))
    emit({
      status: 'encoding',
      percent: Math.min(80, 10 + Math.round(((i + 1) / files.length) * 70)),
      label: `Copying chapters (already AAC)… (${i + 1} of ${files.length} done)`,
    })
  }
  if (canCopyStreams(signatures)) return decodedSec
  await withSingleton((mainFFmpeg) => unmount(mainFFmpeg, PARTS_DIR))
  return null
}

/** Mount the parts on the singleton as PARTS_DIR/enc_N.m4a, ready to join. */
async function mountParts(parts: Blob[]): Promise<void> {
  await withSingleton((mainFFmpeg) =>
    mountBlobs(mainFFmpeg, PARTS_DIR, parts.map((data, i) => ({ name: encodedName(i), data }))),
  )
}

/**
 * Convert a list of audio files into a single chaptered M4B audiobook.
 * All processing happens in-browser via ffmpeg.wasm.
 */
export async function convertToM4B(opts: ConvertOptions): Promise<ConvertResult> {
  const { files, metadata, coverFile, bitrate, onProgress } = opts
  if (files.length === 0) throw new Error('No input files provided.')

  const emit = (p: ConversionProgress) => onProgress?.(p)

  emit({ status: 'loading-ffmpeg', percent: 2, label: ffmpegLoadingLabel() })
  const ffmpeg = await loadEngine(emit, 'conversion')

  // Track all virtual paths created on the singleton FS so we can clean up.
  const tempPaths: string[] = []

  try {
    // 1. Probe durations
    const segments: Array<{ title: string; durationMs: number; ext: string }> = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = fileExtension(f.file.name)
      emit({
        status: 'probing',
        percent: 2 + Math.round((i / files.length) * 8),
        label: `Reading file ${i + 1} of ${files.length}…`,
      })
      let durationMs: number
      if (f.duration != null && isFinite(f.duration) && f.duration > 0) {
        durationMs = Math.round(f.duration * 1000)
      } else {
        const probeName = `probe_${i}.${ext}`
        durationMs = await probeDurationMs(f.file, probeName)
      }
      // A title left blank is written as "Chapter N", as the editor does.
      segments.push({ title: f.chapterTitle.trim() || `Chapter ${i + 1}`, durationMs, ext })
    }

    // 2. Encode or stream-copy inputs to AAC, then register outputs for cleanup.
    // AAC .m4a inputs already at the chosen bitrate are copied as-is when they
    // share one codec config (no CPU cost, no quality loss); everything else
    // goes through the parallel AAC encoding workers at one common target.
    // Each part's decoded length (one part per file, or several for a long
    // file cut into pieces), and which file each part belongs to.
    let partSec: Array<number | null> | null = null
    let partFile: number[] = files.map((_, i) => i)
    if (mayStreamCopy(files, bitrate)) {
      emit({ status: 'encoding', percent: 10, label: 'Copying chapters (already AAC)…' })
      partSec = await copyIfCompatible(files, emit)
    }
    if (!partSec) {
      const workers = workerCount()
      const cuts = await planCuts(files, segments.map((s) => s.durationMs / 1000), workers, emit)
      const jobs = buildJobs(encodeWeights(segments.map((s) => s.durationMs / 1000)), cuts)
      emit({ status: 'encoding', percent: 10, label: 'Encoding chapters…' })
      const encoded = await encodeJobsParallel(files, jobs, workers, bitrate, pickEncodeTarget(files), emit)
      partSec = encoded.decodedSec
      partFile = jobs.map((j) => j.file)
      await mountParts(encoded.parts)
    }
    const decodedParts = partSec

    // 3. Concat list file, with each part's real decoded length so the joined
    // timeline (and the chapter markers below) line up with the audio.
    emit({ status: 'concatenating', percent: 82, label: 'Joining chapters…' })
    const listBody = buildTimedConcatList(
      decodedParts.map((durationSec, i) => ({ name: partPath(i), durationSec })),
    )
    await ffmpeg.writeFile(LIST_PATH, new TextEncoder().encode(listBody))
    tempPaths.push(LIST_PATH)

    // Each file's decoded length: the sum of its parts (null if one is unknown).
    const fileSec = files.map((_, i) => {
      const own = decodedParts.filter((_, k) => partFile[k] === i)
      return own.every((x): x is number => x != null) ? own.reduce((a, b) => a + b, 0) : null
    })

    // 4. Chapter metadata — boundaries from the encoded parts' decoded lengths
    // (source durations are ~20–45 ms short per part, which adds up).
    const chapters = buildChapters(
      segments.map((s, i) => {
        const sec = fileSec[i]
        return { title: s.title, durationMs: sec != null ? sec * 1000 : s.durationMs }
      }),
    )
    // Much shorter than its file said: part of the file couldn't be decoded.
    const shortChapters = findShortChapters(
      segments.map((s, i) => ({ title: s.title, expectedSec: s.durationMs / 1000, gotSec: fileSec[i] })),
    )
    const ffmetaBody = buildFFMetadata(chapters)
    const containerMeta = [';FFMETADATA1', ...buildGlobalMetadata(metadata)].join('\n') + '\n'
    const ffmetaCombined = containerMeta + ffmetaBody.replace(/^;FFMETADATA1\n/, '')
    await ffmpeg.writeFile(META_PATH, new TextEncoder().encode(ffmetaCombined))
    tempPaths.push(META_PATH)

    // 5. Cover art
    let hasCover = false
    if (coverFile) {
      emit({ status: 'muxing', percent: 86, label: 'Preparing cover art…' })
      const resized = await resizeCoverImage(coverFile)
      await ffmpeg.writeFile(COVER_PATH, new Uint8Array(await resized.arrayBuffer()))
      tempPaths.push(COVER_PATH)
      hasCover = true
    }

    // 6. Mux: concat audio + (cover) + chapter metadata → m4b
    emit({ status: 'muxing', percent: 90, label: 'Finalizing audiobook…' })

    const muxArgs: string[] = ['-hide_banner', '-f', 'concat', '-safe', '0', '-i', LIST_PATH]
    if (hasCover) muxArgs.push('-i', COVER_PATH)
    muxArgs.push('-i', META_PATH)

    muxArgs.push('-map', '0:a', '-map_metadata', String(hasCover ? 2 : 1))
    if (hasCover) {
      muxArgs.push('-map', '1', ...OWN_COVER_ARGS, '-disposition:v', 'attached_pic')
    }
    // stik=2 marks the file as an Audiobook so players file it correctly and
    // remember the resume position; pgap enables gapless playback.
    muxArgs.push('-metadata', 'media_type=2', '-metadata:s:a', 'pgap=1')
    muxArgs.push('-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', OUTPUT_PATH)

    // ffmpeg.wasm's 'progress' event rarely fires during stream-copy. Parse
    // 'time=HH:MM:SS.cc' from log lines instead — that fires for stream-copy
    // and gives us a real progress signal during the mux step (which is
    // otherwise invisible and reads like a hang for large audiobooks).
    const totalMuxDurationMs = chapters.length ? chapters[chapters.length - 1].endMs : 0
    const TIME_RE = /time=(\d+):(\d{2}):(\d{2})\.(\d{1,2})/

    const updateMuxProgress = (ratio: number) => {
      emit({
        status: 'muxing',
        percent: Math.min(99, 90 + Math.round(ratio * 9)),
        label: 'Finalizing audiobook…',
      })
    }

    const muxProgress = (p: { progress: number }) => {
      const local = Math.max(0, Math.min(1, p.progress))
      updateMuxProgress(local)
    }
    const muxLog = ({ message }: { message: string }) => {
      const m = message.match(TIME_RE)
      if (!m || totalMuxDurationMs <= 0) return
      const h = Number(m[1])
      const min = Number(m[2])
      const s = Number(m[3])
      const cs = Number(m[4].padEnd(2, '0'))
      const elapsedMs = ((h * 3600 + min * 60 + s) * 100 + cs) * 10
      const ratio = Math.max(0, Math.min(1, elapsedMs / totalMuxDurationMs))
      updateMuxProgress(ratio)
    }
    // Registered before the mux so a half-written output is removed if it fails.
    tempPaths.push(OUTPUT_PATH)
    ffmpeg.on('progress', muxProgress)
    ffmpeg.on('log', muxLog)
    try {
      await runFFmpeg(ffmpeg, muxArgs)
    } catch (err) {
      // Named like the encode steps ("encoding chapter 3/10: …"), so the
      // failure report can say which step it was.
      throw new Error(`joining chapters: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      ffmpeg.off('progress', muxProgress)
      ffmpeg.off('log', muxLog)
    }

    // Free everything but the output before reading it out: this is the peak.
    await unmount(ffmpeg, PARTS_DIR)
    const data = await ffmpeg.readFile(OUTPUT_PATH)
    await safeDelete(ffmpeg, OUTPUT_PATH)
    const blob = new Blob([ownedBytes(data)], { type: 'audio/mp4' })

    emit({ status: 'done', percent: 100, label: 'Done.' })
    return { blob, starts: chapters.map((c) => c.startMs), durationMs: totalMuxDurationMs, shortChapters }
  } catch (err) {
    console.error('mp3tom4b conversion failed:', err)
    emit({ status: 'error', percent: 0, label: humanizeFfmpegError(err) })
    throw err
  } finally {
    await unmount(ffmpeg, PARTS_DIR)
    for (const path of tempPaths) {
      await safeDelete(ffmpeg, path)
    }
  }
}
