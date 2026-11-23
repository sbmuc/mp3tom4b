/**
 * A chapter list as plain text, both ways: pasting one copied from Audible, a
 * book's table of contents, a YouTube description, a cue tool or m4b-tool's
 * chapters.txt, and copying ours out. Pure; nothing leaves the page.
 */

export interface ListedChapter {
  /** Where the chapter starts (ms). */
  startMs: number
  title: string
}

export type ParsedChapterList =
  | { kind: 'empty' }
  /** Lines with a time: the chapters themselves. `skipped` lines had no time. */
  | { kind: 'timed'; chapters: ListedChapter[]; skipped: number }
  /** Only titles, one per line, for the chapters in order. */
  | { kind: 'titles'; titles: string[] }

// 1:02:03, 02:03, 1:02:03.500, 00:01:02,5 (subtitle style). Minutes may run
// past 59 without hours ("75:30"), as some lists write them.
const TIME = String.raw`(\d{1,3}):([0-5]?\d)(?::([0-5]\d))?(?:[.,](\d{1,3}))?`

// "0:00:00 Title", "[12:34] Title", "(1:02:03) - Title", "00:00:00.000 Title"
const LEADING_TIME = new RegExp(String.raw`^[\[(]?${TIME}[\])]?(?:\s*[-–—|:.,)]\s*|\s+|$)(.*)$`)
// "Title 12:34", "Title - 1:02:03", "Title ....... 0:12:34", "Title (12:34)", "Title,0:12:34"
const TRAILING_TIME = new RegExp(String.raw`^(.*?\S)\s*(?:[-–—|:,]\s*|\.{2,}\s*|\s)[\[(]?${TIME}[\])]?$`)
// The OGM / Nero chapter format mkvtoolnix and m4b-tool write.
const NERO_TIME = new RegExp(String.raw`^CHAPTER(\d+)\s*=\s*${TIME}$`, 'i')
const NERO_NAME = /^CHAPTER(\d+)NAME\s*=\s*(.*)$/i

const BULLET = /^(?:[-*•·▪◦]\s+)/
// A table of contents' dot leaders and page number: "Chapter One ........ 12"
const DOT_LEADERS = /\s*(?:\.{3,}|…+)\s*\d*\s*$/

function toMs(a: string, b: string, c: string | undefined, frac: string | undefined): number {
  const [h, m, s] = c !== undefined ? [Number(a), Number(b), Number(c)] : [0, Number(a), Number(b)]
  const ms = frac ? Number(frac.padEnd(3, '0')) : 0
  return ((h * 60 + m) * 60 + s) * 1000 + ms
}

/** A title without the quotes, separators and dot leaders around it. */
function cleanTitle(raw: string): string {
  let t = raw.trim().replace(DOT_LEADERS, '')
  const quoted = /^(["'“‘])(.*)(["'”’])$/.exec(t)
  if (quoted) t = quoted[2]
  return t
    .replace(/^[\s\-–—|:,]+/, '')
    .replace(/[\s\-–—|:,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function timedLine(line: string): ListedChapter | null {
  const lead = LEADING_TIME.exec(line)
  if (lead) return { startMs: toMs(lead[1], lead[2], lead[3], lead[4]), title: cleanTitle(lead[5]) }
  const trail = TRAILING_TIME.exec(line)
  if (trail) return { startMs: toMs(trail[2], trail[3], trail[4], trail[5]), title: cleanTitle(trail[1]) }
  return null
}

/** The Nero format's CHAPTER01=… / CHAPTER01NAME=… pairs, or null when the text isn't in it. */
function neroList(lines: string[]): ListedChapter[] | null {
  const starts = new Map<string, number>()
  const names = new Map<string, string>()
  for (const line of lines) {
    const t = NERO_TIME.exec(line)
    if (t) {
      starts.set(String(Number(t[1])), toMs(t[2], t[3], t[4], t[5]))
      continue
    }
    const n = NERO_NAME.exec(line)
    if (n) {
      names.set(String(Number(n[1])), cleanTitle(n[2]))
      continue
    }
    return null
  }
  if (starts.size === 0) return null
  return [...starts.entries()]
    .map(([num, startMs]) => ({ startMs, title: names.get(num) ?? '' }))
    .sort((x, y) => x.startMs - y.startMs)
}

/**
 * Read a pasted chapter list. When at least half its lines carry a time, it
 * is a list of chapters (sorted by time; the lines without one, like a
 * "Chapters:" heading, are skipped and counted). Otherwise every line is a
 * title, for the chapters already there, in order. A chapter whose line has
 * only a time gets an empty title.
 */
export function parseChapterList(text: string): ParsedChapterList {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(BULLET, '').trim())
    .filter((l) => l !== '')
  if (lines.length === 0) return { kind: 'empty' }

  const nero = neroList(lines)
  if (nero) return { kind: 'timed', chapters: nero, skipped: 0 }

  const parsed = lines.map(timedLine)
  const timed = parsed.filter((c): c is ListedChapter => c !== null)
  if (timed.length > 0 && timed.length * 2 >= lines.length) {
    return {
      kind: 'timed',
      chapters: [...timed].sort((a, b) => a.startMs - b.startMs),
      skipped: lines.length - timed.length,
    }
  }
  const titles = lines.map((line, i) => parsed[i]?.title || cleanTitle(line)).filter((t) => t !== '')
  return titles.length > 0 ? { kind: 'titles', titles } : { kind: 'empty' }
}

/** "1:02:03", with ".500" only when there are milliseconds. */
export function formatListTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const sec = Math.floor(total / 1000)
  const rest = total % 1000
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const clock = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return rest > 0 ? `${clock}.${String(rest).padStart(3, '0')}` : clock
}

/**
 * The chapters as text to copy: "0:00:00 Title" per line when every chapter's
 * start is known, else the titles alone. Pasting it back gives the same list.
 */
export function formatChapterList(chapters: Array<{ startMs: number | null; title: string }>): string {
  const timed = chapters.length > 0 && chapters.every((c) => c.startMs !== null)
  return chapters.map((c) => (timed ? `${formatListTime(c.startMs as number)} ${c.title.trim()}` : c.title.trim())).join('\n')
}

export interface TitlesApplied {
  titles: string[]
  /** Pasted titles past the last chapter, not used. */
  leftOver: number
  /** Chapters past the last pasted title, which keep their own. */
  kept: number
}

/** Pasted titles over the chapters' own, in order; a blank one keeps the chapter's title. */
export function applyTitles(current: string[], pasted: string[]): TitlesApplied {
  return {
    titles: current.map((t, i) => (i < pasted.length && pasted[i].trim() ? pasted[i].trim() : t)),
    leftOver: Math.max(0, pasted.length - current.length),
    kept: Math.max(0, current.length - pasted.length),
  }
}

/** "H:MM:SS", whole seconds, rounded down: the way the chapter rows show a time. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Chapter rows from a list of chapters (a cue sheet's tracks, the chapters a
 * file has, or a pasted list), in whole seconds like the rest of the chapter
 * tools (rounded down, so a marker never lands after its chapter starts). The
 * first starts at 0:00:00; chapters past the end of the audio, or a second one
 * in the same second, are left out and counted. A blank title becomes
 * "Chapter N".
 */
export function timedRows(
  chapters: ListedChapter[],
  durationMs: number,
): { rows: Array<{ timeStr: string; title: string }>; leftOut: number } {
  const rows: Array<{ timeStr: string; title: string }> = []
  let lastSec = -1
  let leftOut = 0
  chapters.forEach((c, i) => {
    const ms = i === 0 ? 0 : c.startMs
    const sec = Math.floor(ms / 1000)
    if ((durationMs > 0 && ms >= durationMs) || sec <= lastSec) {
      leftOut++
      return
    }
    lastSec = sec
    rows.push({ timeStr: formatClock(ms), title: c.title.trim() || `Chapter ${rows.length + 1}` })
  })
  return { rows, leftOut }
}
