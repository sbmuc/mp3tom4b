import { Check, X } from 'lucide-react'

const ROWS: { label: string; us: string; them: string }[] = [
  { label: 'Files leave your device', us: 'Never', them: 'Uploaded to a server' },
  { label: 'Account / signup', us: 'None', them: 'Often required' },
  { label: 'Free tier limits', us: 'No artificial caps', them: '"Free" then paywalled' },
  { label: 'Source code', us: 'Open on GitHub', them: 'Closed' },
  { label: 'Works offline', us: 'After first load', them: 'Server-dependent' },
]

export default function WhyMp3ToM4b() {
  return (
    <section aria-labelledby="why-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 id="why-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Why mp3tom4b?
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Every other browser-based MP3-to-M4B converter we&apos;ve found uploads your audio to a server
        for processing. We don&apos;t. The conversion runs entirely in your browser via WebAssembly.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium"></th>
              <th scope="col" className="px-4 py-2 font-medium text-accent-700 dark:text-accent-400">mp3tom4b</th>
              <th scope="col" className="px-4 py-2 font-medium">Typical web converters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ROWS.map((row) => (
              <tr key={row.label} className="bg-white dark:bg-zinc-950">
                <th scope="row" className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                  {row.label}
                </th>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    {row.us}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <X size={14} className="text-rose-500 dark:text-rose-400" aria-hidden="true" />
                    {row.them}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
