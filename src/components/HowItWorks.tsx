import { Download, FilePlus2, ListMusic } from 'lucide-react'

const STEPS = [
  {
    icon: FilePlus2,
    title: 'Drop your files',
    body: 'Drag MP3, M4A, WAV, FLAC, OGG, or Opus files into the browser. They stay on your device.',
  },
  {
    icon: ListMusic,
    title: 'Add metadata',
    body: 'Reorder chapters, set the title, author, narrator and cover. Embedded tags auto-fill what they can.',
  },
  {
    icon: Download,
    title: 'Download M4B',
    body: 'A single tagged, chaptered audiobook, ready for Apple Books, Plex, or any M4B-aware player.',
  },
]

export default function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
      <h2 id="how-it-works-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        How it works
      </h2>
      <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
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
