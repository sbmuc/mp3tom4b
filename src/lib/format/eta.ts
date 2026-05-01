/**
 * Human-readable estimated time remaining for an in-progress conversion.
 *
 * Returns null when:
 * - percent is too low to project meaningfully (early phases like ffmpeg load
 *   and probing are non-linear),
 * - percent is at the long-tail finalize stage (≥ 99) where the remaining
 *   work is muxing and a numeric estimate would just read "0s",
 * - the projected remaining time is < 5s (just say nothing).
 */
export function formatEta(elapsedMs: number, percent: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return null
  if (!Number.isFinite(percent) || percent < 12 || percent >= 99) return null

  const totalMs = elapsedMs * (100 / percent)
  const remainingMs = totalMs - elapsedMs
  const remainingS = Math.round(remainingMs / 1000)

  if (remainingS < 5) return null
  if (remainingS < 60) return `~${remainingS}s remaining`

  const m = Math.floor(remainingS / 60)
  const s = remainingS % 60
  if (m < 60) return `~${m}m ${s}s remaining`

  const h = Math.floor(m / 60)
  const remM = m % 60
  return `~${h}h ${remM}m remaining`
}
