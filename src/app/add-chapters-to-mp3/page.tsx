import type { Metadata } from 'next'
import FileChapterizer from '@/components/FileChapterizer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Add Chapters to an MP3: Make a Chaptered M4B',
  description:
    'Turn a single long MP3 (or M4A, WAV, FLAC, OGG, Opus) into a chaptered M4B audiobook in your browser. Split evenly, auto-detect chapters from silence, or set your own times. No upload, no signup.',
  alternates: { canonical: '/add-chapters-to-mp3' },
  openGraph: {
    title: 'Add Chapters to an MP3 — Make a Chaptered M4B, Free and Private',
    description:
      'Split one long audio file into a chaptered M4B audiobook, right in your browser — evenly, by silence, or by hand. Runs entirely client-side; your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'Add Chapters to an MP3 — Make a Chaptered M4B, Free and Private',
    description:
      'Split one long audio file into a chaptered M4B audiobook, right in your browser — evenly, by silence, or by hand. Runs entirely client-side; your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: Add Chapters',
  description:
    'Free browser-based tool to turn a single audio file into a chaptered M4B audiobook, with chapters set evenly, by silence detection, or manually. Runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/add-chapters-to-mp3',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'I have one big MP3 with no chapters — can this add them?',
    a: 'Yes. Drop the single file and set chapter marks three ways: split evenly into a number of chapters (or one every N minutes), auto-detect chapters from the pauses in the audio, or type the times yourself. The result is one M4B with proper chapter markers.',
  },
  {
    q: 'How does "detect from silence" work?',
    a: 'It scans the audio for quiet gaps and proposes a chapter break at each pause longer than the threshold you set. It reads the whole file, so it takes a while on long books — and you can always adjust the proposed chapters before converting.',
  },
  {
    q: 'Does this split the file into separate tracks?',
    a: 'No. It keeps the audio as one continuous file and adds chapter markers over it, so you get a single tidy M4B. To split an M4B into one MP3 per chapter instead, use the M4B to MP3 tool.',
  },
  {
    q: 'What files can I use, and does quality drop?',
    a: 'MP3, M4A, M4B, WAV, FLAC, OGG, and Opus. The audio is re-encoded to AAC at the bitrate you choose (64 kbps mono is the audiobook standard and inaudible for speech), with your chapters, cover, and tags written in.',
  },
  {
    q: 'Are my files uploaded anywhere?',
    a: 'No. Everything runs inside your browser using a WebAssembly build of FFmpeg. Your audio never leaves your device. Open your browser\'s Network tab while converting to verify there are no uploads.',
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
  { label: 'Merge M4Bs', href: '/merge-m4b' },
  { label: 'M4B to MP3', href: '/m4b-to-mp3' },
]

export default function AddChaptersPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Add chapters to an MP3
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Turn one long audio file into a chaptered M4B audiobook — split evenly, auto-detect
            chapters from the pauses, or set the times yourself, right in your browser.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <FileChapterizer />

        <section aria-labelledby="how-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="how-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            How adding chapters works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Drop a single audio file and choose where the chapters go: split the book into equal parts,
            let the tool detect breaks at the quiet pauses, or enter the times by hand — then edit any
            of them. The file is re-encoded once to AAC and wrapped in an M4B with your chapter markers,
            cover, and tags. It stays one continuous file, just with a proper chapter list. Everything
            runs locally through a WebAssembly build of FFmpeg — nothing is uploaded.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Adding chapters: common questions
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
