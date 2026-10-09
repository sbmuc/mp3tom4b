import type { Metadata } from 'next'
import M4bMerger from '@/components/M4bMerger'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Merge M4B Files: Combine Audiobooks Into One',
  description:
    'Combine several M4B/M4A files into one audiobook in your browser — perfect for multi-part books. Chapters are placed on a continuous timeline, with cover and tags kept. No upload, no signup.',
  alternates: { canonical: '/merge-m4b' },
  openGraph: {
    title: 'Merge M4B Files: Combine Audiobooks Into One, Free and Private',
    description:
      'Join multi-part M4B audiobooks into a single chaptered file, right in your browser. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'Merge M4B Files: Combine Audiobooks Into One, Free and Private',
    description:
      'Join multi-part M4B audiobooks into a single chaptered file, right in your browser. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: Merge M4B',
  description:
    'Free browser-based tool to merge several M4B audiobooks into one, offsetting each part\'s chapters onto a continuous timeline. Runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/merge-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Does merging keep the chapters from each file?',
    a: 'Yes. Each file\'s chapters are shifted onto one continuous timeline, so a book split across "Part 1", "Part 2", and so on becomes a single file with all chapters in order. You can also choose to make each file a single chapter instead.',
  },
  {
    q: 'How does it join the files — is there quality loss?',
    a: 'When the files share the same audio settings (which parts of the same book almost always do), they are stream-copied together with no re-encode and no quality loss — and it is near-instant. If the files use different settings, they are re-encoded to a common format so they join cleanly; a notice tells you when that happens.',
  },
  {
    q: 'Can I set the order of the files?',
    a: 'Yes. Drag the files into the order you want (or use the keyboard). They are joined top-to-bottom, and the chapter timeline follows that order.',
  },
  {
    q: 'What about the cover and metadata?',
    a: 'The merged file uses the first file\'s cover by default, but you can pick any input file\'s cover, upload a new image, or remove it. You also set the title, author, narrator, year, and genre for the combined book — prefilled from the first file.',
  },
  {
    q: 'Are my files uploaded anywhere?',
    a: 'No. Merging runs entirely inside your browser using a WebAssembly build of FFmpeg. Your audiobooks never leave your device. Open your browser\'s Network tab while merging to verify there are no uploads.',
  },
]

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

const RELATED = [
  { label: 'MP3 to M4B', href: '/' },
  { label: 'Compress an M4B', href: '/compress-m4b' },
  { label: 'Edit M4B chapters', href: '/edit-m4b-chapters' },
  { label: 'M4B to MP3', href: '/m4b-to-mp3' },
  { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3' },
  { label: 'M4B player', href: '/m4b-player' },
]

export default function MergeM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Merge M4B files
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Combine several M4B audiobooks into one — ideal for multi-part books. Chapters from every
            file land on a single continuous timeline, right in your browser.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <M4bMerger />

        <section aria-labelledby="how-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="how-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            How merging M4B files works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Drop two or more M4B files, drag them into order, and the tool reads each file&apos;s
            chapters and length. It then joins them into a single audiobook, shifting every chapter
            onto one continuous timeline. When the files share the same audio settings they are joined
            without re-encoding — fast and lossless; otherwise they are re-encoded to a common format
            so they play back seamlessly. Everything runs locally through a WebAssembly build of
            FFmpeg — nothing is uploaded.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Merging M4B: common questions
          </h2>
          <dl className="mt-6 space-y-5">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="related-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="related-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            More M4B tools
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {RELATED.map(({ label, href }) => (
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
      </div>
    </>
  )
}
