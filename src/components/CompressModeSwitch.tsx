'use client'

import { useState } from 'react'
import { Download, FileStack, Minimize2, Sliders, Upload } from 'lucide-react'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import M4bCompressor from '@/components/M4bCompressor'

type Mode = 'shrink' | 'build'

const TABS: { id: Mode; label: string; icon: typeof Minimize2 }[] = [
  { id: 'shrink', label: 'Shrink an existing M4B', icon: Minimize2 },
  { id: 'build', label: 'Build from separate files', icon: FileStack },
]

const SHRINK_STEPS = [
  {
    icon: Upload,
    title: 'Drop a finished M4B',
    body: 'Add one existing .m4b or .m4a file. It stays on your device — nothing is uploaded.',
  },
  {
    icon: Sliders,
    title: 'Pick a lower bitrate',
    body: 'See the current bitrate and the estimated new size, then choose how much to shrink.',
  },
  {
    icon: Download,
    title: 'Download the smaller file',
    body: 'Same chapters, cover art, and metadata — just a smaller file, ready for any M4B player.',
  },
]

function ShrinkSteps() {
  return (
    <section
      aria-labelledby="shrink-how-heading"
      className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800"
    >
      <h2 id="shrink-how-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        How it works
      </h2>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {SHRINK_STEPS.map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
              <Icon size={20} aria-hidden="true" />
              <span className="font-mono text-xs">Step {i + 1}</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

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
      {mode === 'shrink' ? <ShrinkSteps /> : <HowItWorks />}
    </div>
  )
}
