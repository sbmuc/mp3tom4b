import { parseBlob } from 'music-metadata'
import { readMp4Chapters, type Chapter } from './mp4Chapters'

export type { Chapter }

/** What the player shows for a file, read in-browser; nothing is uploaded. */
export interface PlaybackInfo {
  title?: string
  author?: string
  narrator?: string
  cover?: Blob
  chapters: Chapter[]
}

/** True when the file starts like an MP4 (`ftyp` box): M4B, M4A, MP4. */
async function isMp4(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(4, 8).arrayBuffer())
  return new TextDecoder().decode(head) === 'ftyp'
}

/**
 * Tags, cover, and chapters for playback. MP4 chapters come from our own box
 * reader (see mp4Chapters.ts); MP3 chapters are ID3 `CHAP` frames, which
 * music-metadata maps to seconds. Never rejects: an unreadable file just has
 * no tags and no chapters, and the browser decides whether it plays.
 */
export async function readPlaybackInfo(file: Blob): Promise<PlaybackInfo> {
  const mp4 = await isMp4(file).catch(() => false)
  const [tags, mp4Chapters] = await Promise.all([
    parseBlob(file).catch(() => null),
    mp4 ? readMp4Chapters(file) : null,
  ])
  const common = tags?.common
  const picture = common?.picture?.[0]

  return {
    // An M4B keeps the book title in its title tag; an MP3 chapter file keeps
    // it in the album and its own chapter name in the title.
    title: (mp4 ? common?.title || common?.album : common?.album || common?.title)?.trim() || undefined,
    author: (common?.artist || common?.albumartist)?.trim() || undefined,
    narrator: common?.composer?.[0]?.trim() || undefined,
    cover: picture ? new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' }) : undefined,
    chapters:
      mp4Chapters ??
      (tags?.format.chapters ?? [])
        .map((c) => ({ title: c.title.trim(), startSec: c.start }))
        .filter((c) => Number.isFinite(c.startSec)),
  }
}

/**
 * MIME type to hand the browser's audio element. Dropped `.m4b` files often
 * come with an empty or non-standard type, which Safari won't play.
 */
export function playbackType(file: Blob, name: string): string {
  return file.type === 'audio/mpeg' || /\.mp3$/i.test(name) ? 'audio/mpeg' : 'audio/mp4'
}

// A seek to a chapter's start can land a hair before it; don't count that as
// still being in the previous chapter.
const START_TOLERANCE_SEC = 0.05

/** Index of the chapter playing at `timeSec`, or -1 before the first one. */
export function chapterIndexAt(chapters: Chapter[], timeSec: number): number {
  let index = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startSec <= timeSec + START_TOLERANCE_SEC) index = i
    else break
  }
  return index
}

// Like a CD player: "previous" restarts the current chapter unless you're
// within the first few seconds of it.
const RESTART_WINDOW_SEC = 3

/** Where "previous chapter" goes from `timeSec`. */
export function previousChapterStart(chapters: Chapter[], timeSec: number): number {
  const i = chapterIndexAt(chapters, timeSec)
  if (i < 0) return 0
  if (timeSec - chapters[i].startSec > RESTART_WINDOW_SEC) return chapters[i].startSec
  return i > 0 ? chapters[i - 1].startSec : 0
}
