'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { useConversionStore } from '@/lib/store/conversionStore'
import {
  bitrateAdvice,
  DEFAULT_BITRATE,
  effectiveKbps,
  estimateOutputBytes,
  formatEstimatedSize,
  LIKELY_TOO_BIG_BYTES,
  type BitrateAdvice,
} from '@/lib/audio/bitrate'
import { pickEncodeTarget } from '@/lib/ffmpeg/concatPlan'
import type { Bitrate } from '@/types'

interface Option {
  value: Bitrate
  label: string
  hint: string
}

const OPTIONS: Option[] = [
  { value: 64, label: '64 kbps', hint: 'recommended for audiobooks (spoken word)' },
  { value: 96, label: '96 kbps', hint: 'higher quality (music or audio with effects)' },
  { value: 128, label: '128 kbps', hint: 'best quality for most use cases' },
  { value: 192, label: '192 kbps', hint: 'high quality for music-heavy content' },
  { value: 256, label: '256 kbps', hint: 'maximum quality (large file size)' },
]

const ADVANCED_OPTIONS = OPTIONS.filter((o) => o.value !== DEFAULT_BITRATE)

/** 22050 → "22", 44100 → "44.1", 48000 → "48". */
function kHz(rate: number): string {
  return rate === 44100 ? '44.1' : String(Math.floor(rate / 1000))
}

function adviceText(a: BitrateAdvice, mixed: boolean): string {
  if (a.reason === 'source') {
    return `Your audio is ${mixed ? 'at most ' : ''}${a.sourceKbps} kbps, so a higher bitrate makes the M4B bigger, not better: ${a.enough} kbps keeps everything in it.`
  }
  return `Your audio is ${kHz(a.sampleRate ?? 0)} kHz, where the encoder tops out at about ${a.ceilingKbps} kbps, so above ${a.enough} kbps the M4B gets neither bigger nor better.`
}

export default function BitrateSelector() {
  const bitrate = useConversionStore((s) => s.bitrate)
  const setBitrate = useConversionStore((s) => s.setBitrate)
  const bitrateUserTouched = useConversionStore((s) => s.bitrateUserTouched)
  const files = useConversionStore((s) => s.files)
  const totalSeconds = files.reduce((acc, f) => acc + (f.duration ?? 0), 0)
  const [userExpanded, setUserExpanded] = useState<boolean>(
    () => useConversionStore.getState().bitrate !== DEFAULT_BITRATE
  )

  // Force-expanded if a non-default bitrate is selected — collapsed view
  // only ever represents the recommended default, never a non-default choice.
  const isNonDefault = bitrate !== DEFAULT_BITRATE
  const expanded = userExpanded || isNonDefault

  const radio = (opt: Option) => {
    const selected = opt.value === bitrate
    return (
      <label
        key={opt.value}
        className={`flex cursor-pointer items-baseline gap-3 rounded-md border p-3 transition-colors ${
          selected
            ? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-950/40'
            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
        }`}
      >
        <input
          type="radio"
          name="bitrate"
          value={opt.value}
          checked={selected}
          onChange={() => setBitrate(opt.value)}
          className="h-4 w-4 shrink-0 self-center accent-accent-600"
        />
        <span className="flex-1">
          <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {opt.label}
          </span>
          <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">· {opt.hint}</span>
        </span>
      </label>
    )
  }

  // When collapsed, only the default option is rendered (the recommended pick).
  const visibleOptions = expanded ? OPTIONS : OPTIONS.filter((o) => o.value === DEFAULT_BITRATE)

  // The size at what the encoder really reaches: at 22 kHz, 256 kbps comes
  // out at about 110, and the estimate was three times too big.
  const readable = files.filter((f) => !f.unreadable)
  const target = pickEncodeTarget(readable)
  const actualKbps = effectiveKbps(bitrate, target)
  const estimatedBytes = totalSeconds > 0 ? estimateOutputBytes(totalSeconds, actualKbps) : 0
  const estimateLabel = formatEstimatedSize(estimatedBytes)
  const advice = bitrateAdvice(bitrate, readable)
  const tooBig = estimatedBytes > LIKELY_TOO_BIG_BYTES
  const at64 = formatEstimatedSize(estimateOutputBytes(totalSeconds, effectiveKbps(DEFAULT_BITRATE, target)))
  const mixedSources = new Set(readable.map((f) => f.sourceBitrateKbps)).size > 1

  // Smart suggestion bumped the bitrate above the standard default automatically.
  const showSmartHint = !bitrateUserTouched && bitrate !== DEFAULT_BITRATE

  return (
    <section aria-label="Output bitrate" className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Output bitrate
      </h2>

      <div role="radiogroup" aria-label="Bitrate" className="flex flex-col gap-2">
        {visibleOptions.map(radio)}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* Toggle is hidden when a non-default bitrate is active — to collapse,
            the user has to first re-pick the default 64 kbps. */}
        {!isNonDefault && (
          <button
            type="button"
            onClick={() => setUserExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="bitrate-advanced"
            className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400 dark:hover:text-accent-300"
          >
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform ${expanded ? 'rotate-180' : 'rotate-0'}`}
            />
            {expanded ? 'Show fewer options' : 'Show advanced options'}
          </button>
        )}

        {showSmartHint && (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            Suggested based on your source files.
          </span>
        )}

        {estimateLabel && (
          <span
            aria-live="polite"
            className="ml-auto font-mono text-xs text-zinc-500 dark:text-zinc-400"
          >
            {estimateLabel} at {actualKbps < bitrate ? `~${actualKbps}` : bitrate} kbps
          </span>
        )}
      </div>

      {tooBig && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            At {estimateLabel} this audiobook is bigger than a browser can usually put together (books up to about 2 GB
            work), so it may stop near the end, after the long encode.{' '}
            {bitrate > DEFAULT_BITRATE
              ? `Pick a lower bitrate (at ${DEFAULT_BITRATE} kbps it's ${at64}) or convert the book in two parts.`
              : 'Convert the book in two parts.'}
          </p>
        </div>
      )}

      {advice && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-accent-700 dark:text-accent-400" aria-hidden="true" />
          <div className="flex-1">
            <p>{adviceText(advice, mixedSources)}</p>
            <button
              type="button"
              onClick={() => setBitrate(advice.enough)}
              className="mt-2 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Use {advice.enough} kbps
            </button>
          </div>
        </div>
      )}

      {/* Hidden hint targets so aria-controls has something stable to point at. */}
      <span id="bitrate-advanced" className="sr-only">
        {ADVANCED_OPTIONS.map((o) => o.label).join(', ')}
      </span>
    </section>
  )
}
