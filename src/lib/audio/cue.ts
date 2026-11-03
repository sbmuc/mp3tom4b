/**
 * Cue sheets: the .cue file rippers (EAC, foobar2000, XLD) write next to one
 * big audio file, listing where each track starts. For an audiobook those are
 * its chapters, with exact times and often titles, which beats guessing from
 * silence. Read entirely in the browser.
 */

export interface CueChapter {
  /** Start of the track's audio (INDEX 01), in ms from the start of the file. */
  startMs: number
  title: string
}

export interface CueSheet {
  /** Album-level TITLE, usually the book title. */
  title?: string
  /** Album-level PERFORMER, usually the author or narrator. */
  performer?: string
  /** Every FILE the sheet names, in order. */
  files: string[]
  /** Tracks in order, as chapters. Times are relative to the file they're in. */
  chapters: CueChapter[]
}

/** A cue sheet's text: UTF-8 when it is valid UTF-8, else Windows-1252 (what older rippers wrote). */
export function decodeCueBytes(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes)
  }
  return text.replace(/^﻿/, '')
}

/** "MM:SS:FF" (minutes can run past 99 on long books; 75 frames a second) to ms. */
function cueTimeToMs(time: string): number | null {
  const m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(time)
  if (!m) return null
  const [minutes, seconds, frames] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (seconds > 59 || frames > 74) return null
  return Math.round((minutes * 60 + seconds) * 1000 + (frames * 1000) / 75)
}

/** A command's argument, with or without quotes. */
function argument(rest: string): string {
  const quoted = /^"(.*)"/.exec(rest)
  return (quoted ? quoted[1] : rest.split(/\s+/)[0] ?? '').trim()
}

/**
 * Parse a cue sheet. Tracks without INDEX 01 are skipped; a track without a
 * TITLE becomes "Track N". Returns null when nothing usable is in it.
 */
export function parseCue(text: string): CueSheet | null {
  const sheet: CueSheet = { files: [], chapters: [] }
  let track: { number: number; title?: string; startMs?: number } | null = null
  const finishTrack = () => {
    if (track?.startMs != null) {
      sheet.chapters.push({ startMs: track.startMs, title: track.title || `Track ${track.number}` })
    }
    track = null
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const m = /^(\w+)\s*(.*)$/.exec(line)
    if (!m) continue
    const command = m[1].toUpperCase()
    const rest = m[2]
    switch (command) {
      case 'FILE':
        finishTrack()
        sheet.files.push(argument(rest))
        break
      case 'TRACK':
        finishTrack()
        track = { number: Number.parseInt(rest, 10) || sheet.chapters.length + 1 }
        break
      case 'TITLE':
        if (track) track.title = argument(rest)
        else sheet.title = argument(rest)
        break
      case 'PERFORMER':
        if (!track) sheet.performer = argument(rest)
        break
      case 'INDEX': {
        const [number, time] = rest.split(/\s+/)
        if (track && Number(number) === 1) track.startMs = cueTimeToMs(time ?? '') ?? undefined
        break
      }
    }
  }
  finishTrack()

  if (sheet.chapters.length === 0) return null
  if (!sheet.title) delete sheet.title
  if (!sheet.performer) delete sheet.performer
  return sheet
}

export function isCueFile(name: string): boolean {
  return /\.cue$/i.test(name)
}
