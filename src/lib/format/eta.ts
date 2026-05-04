/**
 * Human-readable estimated time remaining.
 *
 * `elapsedMs` and `percent` (0–100) must both refer to the same work window —
 * typically the encoding phase only, so that fast early phases (ffmpeg load,
 * probing) don't skew the projection.
 *
 * Returns null when there is too little data to project meaningfully or the
 * remaining time is trivially short.
 */
export function formatEta(elapsedMs: number, percent: number): string | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return null
  if (!Number.isFinite(percent) || percent < 5 || percent >= 99) return null

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
