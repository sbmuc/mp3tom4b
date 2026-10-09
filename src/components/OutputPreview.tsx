'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronDown, Headphones } from 'lucide-react'
import AudioPlayer from '@/components/AudioPlayer'

interface Props {
  /** The finished audiobook, still in memory. */
  file: Blob
  /** The download name, used as a fallback title. */
  fileName: string
}

/**
 * "Preview" disclosure on a download card: plays the result in place so the
 * chapters and audio can be checked before the file goes to a phone or player.
 * Must sit outside the card's `role="status"` region, or a screen reader would
 * read out every change in the player.
 */
export default function OutputPreview({ file, fileName }: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // A new result closes the preview of the old one.
  useEffect(() => setOpen(false), [file])

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-sm font-medium text-emerald-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-200"
      >
        <Headphones size={16} aria-hidden="true" />
        {open ? 'Hide preview' : 'Preview: listen and check the chapters'}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="mt-2">
          <AudioPlayer file={file} fileName={fileName} />
        </div>
      )}
    </div>
  )
}
