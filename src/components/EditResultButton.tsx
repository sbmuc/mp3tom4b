'use client'

import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { handOffToEditor } from '@/lib/handoff'

interface Props {
  /** The finished M4B. */
  blob: Blob
  fileName: string
}

/**
 * "Edit chapters & tags" on a result card: opens the finished M4B in the
 * editor without downloading and dropping it again. The editor only rewrites
 * tags, chapters and cover around the same audio, so a fix there takes
 * seconds instead of another conversion.
 */
export default function EditResultButton({ blob, fileName }: Props) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        handOffToEditor(new File([blob], fileName, { type: 'audio/mp4' }))
        router.push('/edit-m4b-chapters')
      }}
      className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <Pencil size={14} aria-hidden="true" />
      Edit chapters &amp; tags
    </button>
  )
}
