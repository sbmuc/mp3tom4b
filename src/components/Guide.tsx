import Link from 'next/link'
import type { ReactNode } from 'react'
import { GUIDES } from '@/lib/guides'

// Building blocks for the how-to pages (m4b-on-iphone, m4b-on-android,
// librivox-to-m4b), in the same type styles as /about.

export const guideH2 = 'mt-10 text-xl font-semibold text-zinc-900 dark:text-zinc-100'
export const guideLink = 'text-accent-700 underline hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300'

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-3 list-decimal space-y-2 pl-6 marker:font-mono marker:text-zinc-500">{children}</ol>
}

/** A grey aside: "No M4B yet? …", a tested example, a tip. */
export function GuideNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </p>
  )
}

export interface GuideQuestion {
  q: string
  /** Plain text, also used for the FAQPage structured data. */
  a: string
}

/** Questions as a list on the page and as FAQPage structured data. */
export function GuideFaq({ heading, items }: { heading: string; items: GuideQuestion[] }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  return (
    <section aria-labelledby="guide-faq" className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 id="guide-faq" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {heading}
      </h2>
      <dl className="mt-4 space-y-4">
        {items.map(({ q, a }) => (
          <div key={q} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="font-semibold text-zinc-900 dark:text-zinc-100">{q}</dt>
            <dd className="mt-1 text-sm leading-relaxed">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The other guides and the tools a reader of this one may want next. */
export function MoreGuides({ current }: { current: string }) {
  const links = [
    ...GUIDES.filter((g) => g.href !== current),
    { href: '/', label: 'MP3 to M4B converter' },
    { href: '/edit-m4b-chapters', label: 'Edit M4B chapters' },
    { href: '/m4b-player', label: 'M4B player' },
  ]
  return (
    <section aria-labelledby="more-guides" className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 id="more-guides" className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        More guides and tools
      </h2>
      <ul className="mt-4 flex flex-wrap gap-3">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:border-accent-400 hover:text-accent-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-accent-500 dark:hover:text-accent-400"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
