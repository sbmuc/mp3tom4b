'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

const TOOLS = [
  { href: '/', label: 'MP3 to M4B', hint: 'Turn audio files into one audiobook' },
  { href: '/compress-m4b', label: 'Compress M4B', hint: 'Make an audiobook smaller' },
  { href: '/edit-m4b-chapters', label: 'Edit M4B', hint: 'Chapters, tags and cover' },
  { href: '/merge-m4b', label: 'Merge M4Bs', hint: 'Join several books into one' },
  { href: '/m4b-to-mp3', label: 'M4B to MP3', hint: 'Split into one MP3 per chapter' },
  { href: '/add-chapters-to-mp3', label: 'Add chapters', hint: 'Chapter one long file' },
  { href: '/m4b-player', label: 'M4B player', hint: 'Listen in your browser' },
]

/**
 * The header's "Tools" disclosure: every tool, one click from any page. A plain
 * list of links (site navigation, not an app menu), closed by Escape, a click
 * outside, or moving to another page.
 */
export default function ToolsMenu({ className }: { className: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    // Positioned only from sm up: on a phone the panel spans the header instead.
    <div ref={wrapRef} className="sm:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${className} gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500`}
      >
        Tools
        <ChevronDown size={14} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg sm:left-auto sm:right-0 sm:w-80 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <ul>
          {TOOLS.map((t) => {
            const current = pathname === t.href
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                    current ? 'bg-accent-50 dark:bg-accent-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.label}</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">{t.hint}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
