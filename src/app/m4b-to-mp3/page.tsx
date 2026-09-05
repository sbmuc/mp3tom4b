import type { Metadata } from 'next'
import M4bSplitter from '@/components/M4bSplitter'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'M4B to MP3: Split an Audiobook into Chapter MP3s',
  description:
    'Split an M4B audiobook into per-chapter MP3 files in your browser — or convert it to a single MP3. No upload, no signup. Chapters become separate, tagged MP3s in a ZIP.',
  alternates: { canonical: '/m4b-to-mp3' },
  openGraph: {
    title: 'M4B to MP3 Converter: Split by Chapter, Free and Private',
    description:
      'Turn an M4B audiobook into per-chapter MP3 files, right in your browser. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'M4B to MP3 Converter: Split by Chapter, Free and Private',
    description:
      'Turn an M4B audiobook into per-chapter MP3 files, right in your browser. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: M4B to MP3',
  description:
    'Free browser-based tool to split an M4B audiobook into per-chapter MP3 files. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/m4b-to-mp3',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Does each chapter become its own MP3?',
    a: 'Yes. Each chapter in the M4B is exported as a separate MP3, named and numbered by chapter, and the files are bundled into a single ZIP for download. If the M4B has no chapters, the whole book is exported as one MP3 instead.',
  },
  {
    q: 'Why convert an M4B to MP3?',
    a: 'MP3 plays on virtually any device and app, including older players and car stereos that do not understand M4B. Splitting by chapter also makes it easy to re-organise, edit, or load individual sections.',
  },
  {
    q: 'Will splitting reduce the audio quality?',
    a: 'The chapters are re-encoded to MP3, so there is a small generational loss as with any re-encode. For spoken word, 64 kbps is transparent; choose 96 or 128 kbps for recordings with music or effects.',
  },
  {
    q: 'Are my files uploaded anywhere?',
    a: 'No. Splitting runs entirely inside your browser using a WebAssembly build of FFmpeg. Your audiobook never leaves your device. Open your browser\'s Network tab while splitting to verify there are no uploads.',
  },
  {
    q: 'Do the MP3 files keep their titles and tags?',
    a: 'Yes. Each MP3 gets the chapter title, a track number, and the book title and author as album/artist tags, so they stay ordered and identifiable in your library.',
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
  { label: 'FLAC to M4B', href: '/flac-to-m4b' },
  { label: 'WAV to M4B', href: '/wav-to-m4b' },
  { label: 'M4A to M4B', href: '/m4a-to-m4b' },
]

export default function M4bToMp3Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            M4B to MP3
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Split an M4B audiobook into per-chapter MP3 files, right in your browser — perfect for
            players that do not support M4B.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <M4bSplitter />

        <section aria-labelledby="how-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="how-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            How M4B to MP3 splitting works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Drop a finished M4B and the tool reads its chapter markers, re-encodes each chapter to
            an MP3 at the bitrate you pick, tags it with the chapter title and track number, and
            bundles the set into a ZIP. A file without chapters becomes a single MP3. Everything runs
            locally through a WebAssembly build of FFmpeg — nothing is uploaded.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            M4B to MP3: common questions
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
