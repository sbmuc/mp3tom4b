import { failureReason } from '@/lib/ffmpeg/errors'

/** Event properties: counts, sizes, durations and settings only. */
export type EventData = Record<string, string | number | boolean>

/** The fields Umami sends with an event (its own payload, which we only adjust). */
export interface UmamiPayload {
  url?: string
  name?: string
  data?: EventData
  [field: string]: unknown
}

declare global {
  interface Window {
    umami?: { track: (payload: (base: UmamiPayload) => UmamiPayload) => void }
  }
}

/**
 * Anonymous, cookieless usage events via Umami (the script is loaded from
 * /stats/script.js, see layout.tsx). Callers pass only counts, sizes,
 * durations and settings: never a file name, a tag, or anything read from a
 * file. Does nothing when the script isn't there (localhost, preview deploys,
 * blockers, Do Not Track), and never lets analytics break a tool.
 */
export function trackEvent(name: string, data?: EventData): void {
  try {
    // Umami's page is the one the script loaded on: with its automatic page
    // views off it doesn't follow client-side navigation, so an event fired on
    // /add-chapters-to-mp3 after arriving on / was filed under /. Send the
    // page the event really happened on.
    window.umami?.track((base) => ({ ...base, url: window.location.pathname, name, data }))
  } catch {
    // analytics must never get in the way
  }
}

export type ToolName = 'convert' | 'compress' | 'split' | 'edit' | 'merge' | 'chapterize' | 'detect_silence'

/**
 * A tool run that ended in an error (not a cancel). Sends the kind of failure
 * only, never the message, which can contain file or chapter names.
 */
export function trackFailure(tool: ToolName, err: unknown, data: EventData = {}): void {
  trackEvent('tool_failed', { tool, reason: failureReason(err), ...data })
}
