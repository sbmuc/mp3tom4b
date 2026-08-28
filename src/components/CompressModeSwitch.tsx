'use client'

import { useState } from 'react'
import { FileStack, Minimize2 } from 'lucide-react'
import ConverterTool from '@/components/ConverterTool'
import M4bCompressor from '@/components/M4bCompressor'

type Mode = 'shrink' | 'build'

const TABS: { id: Mode; label: string; icon: typeof Minimize2 }[] = [
  { id: 'shrink', label: 'Shrink an existing M4B', icon: Minimize2 },
  { id: 'build', label: 'Build from separate files', icon: FileStack },
]

export default function CompressModeSwitch() {
  const [mode, setMode] = useState<Mode>('shrink')

  return (
    <div className="mt-4">
      <div
        role="tablist"
        aria-label="Compression mode"
        className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
                active
                  ? 'bg-white text-accent-700 shadow-sm dark:bg-zinc-950 dark:text-accent-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>

      {mode === 'shrink' ? <M4bCompressor /> : <ConverterTool />}
    </div>
  )
}
