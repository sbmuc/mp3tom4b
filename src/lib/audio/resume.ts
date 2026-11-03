/**
 * The M4B player's "pick up where you left off": the last position per book,
 * kept in this browser's localStorage and nowhere else. A book is known by a
 * hash of its file name and size, so the stored keys don't spell out what
 * anyone listens to. Every access is wrapped: storage can be full, blocked, or
 * missing (private windows), and then the player simply starts at 0:00.
 */

const PREFIX = 'mp3tom4b.resume.'
/** Books remembered; the ones played longest ago are dropped first. */
export const MAX_BOOKS = 50
/** Nearer the start or the end than this, starting over is what you want. */
export const RESUME_MARGIN_SEC = 30

interface Saved {
  /** Position in seconds. */
  t: number
  /** When it was saved (ms since epoch), to drop the oldest. */
  at: number
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The storage key for a book: a SHA-256 of its name and size, shortened. */
export async function resumeKey(name: string, size: number): Promise<string> {
  const bytes = new TextEncoder().encode(`${name}\n${size}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return PREFIX + hex.slice(0, 32)
}

function read(store: Store, key: string): Saved | null {
  try {
    const value: unknown = JSON.parse(store.getItem(key) ?? 'null')
    if (value && typeof value === 'object' && typeof (value as Saved).t === 'number' && typeof (value as Saved).at === 'number') {
      return value as Saved
    }
  } catch {
    // unreadable entry: treat as none
  }
  return null
}

/** The saved position in seconds, or null. */
export function loadPosition(key: string, store: Store | null = defaultStore()): number | null {
  if (!store) return null
  return read(store, key)?.t ?? null
}

/** Remember a position, dropping the least recently played books beyond MAX_BOOKS. */
export function savePosition(key: string, sec: number, store: Store | null = defaultStore(), now = Date.now()): void {
  if (!store || !Number.isFinite(sec)) return
  try {
    store.setItem(key, JSON.stringify({ t: Math.round(sec), at: now } satisfies Saved))
    const ours: { key: string; at: number }[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith(PREFIX)) ours.push({ key: k, at: read(store, k)?.at ?? 0 })
    }
    if (ours.length <= MAX_BOOKS) return
    ours.sort((a, b) => a.at - b.at)
    for (const { key: old } of ours.slice(0, ours.length - MAX_BOOKS)) store.removeItem(old)
  } catch {
    // storage full or blocked: the position just isn't remembered
  }
}

export function clearPosition(key: string, store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(key)
  } catch {
    // nothing to clear
  }
}

/**
 * Whether a saved position is worth jumping to: not in the first or last half
 * minute, and inside the book when its length is known.
 */
export function shouldResume(sec: number | null, durationSec: number): sec is number {
  if (sec == null || sec < RESUME_MARGIN_SEC) return false
  return !(durationSec > 0 && sec > durationSec - RESUME_MARGIN_SEC)
}
