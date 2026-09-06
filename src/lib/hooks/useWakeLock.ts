'use client'

import { useEffect } from 'react'

/**
 * Hold a screen wake lock while `active` is true, so the display doesn't sleep
 * (and throttle/suspend the tab and its wasm workers) during a long conversion.
 *
 * The browser auto-releases the lock whenever the tab is hidden, so we re-acquire
 * it on `visibilitychange` when the tab comes back to the foreground. No-ops on
 * browsers without the Wake Lock API, or when the request is denied.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) {
          next.release().catch(() => {})
          return
        }
        sentinel = next
      } catch {
        // User gesture missing, page hidden, or policy denial — ignore.
      }
    }

    acquire()

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (sentinel === null || sentinel.released)) {
        acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}
