'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

type CompatState = 'pending' | 'ok' | 'unsupported'

export default function CompatibilityNotices() {
  const [compat, setCompat] = useState<CompatState>('pending')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // The single-threaded ffmpeg core needs WebAssembly and Web Workers, nothing
    // more: no SharedArrayBuffer and no cross-origin isolation.
    const hasWasm = typeof WebAssembly !== 'undefined'
    const hasWorker = typeof Worker !== 'undefined'
    setCompat(hasWasm && hasWorker ? 'ok' : 'unsupported')

    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      {compat === 'unsupported' && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">This browser can&apos;t run the converter.</p>
            <p className="mt-0.5 text-xs">
              It needs WebAssembly and Web Workers. Open this page in a recent Chrome, Edge, Firefox, or Safari.
            </p>
          </div>
        </div>
      )}
      {compat === 'ok' && isMobile && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          <Info size={16} className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
          <p className="text-xs">
            This tool works on phones, but large audiobooks may run out of memory. For anything over an hour, use a desktop browser.
          </p>
        </div>
      )}
    </>
  )
}
