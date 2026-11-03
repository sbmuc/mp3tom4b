import type { ReactNode } from 'react'

/**
 * Shown with a finished audiobook: someone making their first M4B usually
 * doesn't know how to get it onto a phone or into Apple Books, and nothing
 * else on the page says so. Links open in a new tab, because the result here
 * is only kept in this page.
 */
export default function WhereToListen() {
  const linkClass = 'text-accent-700 underline hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300'
  const rows: { where: string; how: ReactNode }[] = [
    { where: 'Mac', how: 'Drag the file into the Books app. It shows up under Audiobooks.' },
    {
      where: 'iPhone, iPad',
      how: (
        <>
          Connect it to your Mac, select it in Finder and sync the book on the Audiobooks tab (on Windows: iTunes).
          Without a computer: save the file to the Files app and open it in a free player such as BookPlayer.
        </>
      ),
    },
    {
      where: 'Android',
      how: 'Copy the file to your phone and open it in an audiobook app such as Voice or Smart AudioBook Player.',
    },
    {
      where: 'Audiobookshelf',
      how: 'Put it in your audiobooks folder, one folder per book, and scan the library. Other audiobook servers work the same way.',
    },
    {
      where: 'Any computer',
      how: (
        <>
          Play it in your browser with the{' '}
          <a href="/m4b-player" target="_blank" rel="noopener" className={linkClass}>
            M4B player
          </a>
          , chapters included.
        </>
      ),
    },
  ]

  return (
    <section
      aria-labelledby="where-to-listen"
      className="mt-4 rounded-md border border-emerald-200 bg-white/70 p-3 text-xs text-zinc-700 dark:border-emerald-900 dark:bg-zinc-950/40 dark:text-zinc-300"
    >
      <h3 id="where-to-listen" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Where to listen
      </h3>
      <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
        {rows.map(({ where, how }) => (
          <div key={where} className="contents">
            <dt className="font-medium text-zinc-900 dark:text-zinc-100">{where}</dt>
            <dd className="mb-1 sm:mb-0">{how}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
