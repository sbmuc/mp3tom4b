import type { Metadata } from 'next'
import M4bEditor from '@/components/M4bEditor'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Edit M4B Chapters & Metadata',
  description:
    'Edit an M4B audiobook in your browser: rename, add, remove, or re-time chapters, fix the title/author/narrator tags, and swap the cover. No upload, no re-encode — the audio is untouched.',
  alternates: { canonical: '/edit-m4b-chapters' },
  openGraph: {
    title: 'M4B Chapter & Metadata Editor: Free, Private, No Upload',
    description:
      'Fix chapters, tags, and cover art on an M4B audiobook, right in your browser. Runs entirely client-side via WebAssembly; the audio is copied, never re-encoded.',
  },
  twitter: {
    card: 'summary',
    title: 'M4B Chapter & Metadata Editor: Free, Private, No Upload',
    description:
      'Fix chapters, tags, and cover art on an M4B audiobook, right in your browser. Runs entirely client-side via WebAssembly; the audio is copied, never re-encoded.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: M4B Editor',
  description:
    'Free browser-based tool to edit chapters, metadata, and cover art in an M4B audiobook without re-encoding. Runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/edit-m4b-chapters',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Can I add chapters to an M4B that has none?',
    a: 'Yes. Drop the file, then use "Add chapter" to place markers at the times you want, each with its own title. It also works the other way — you can remove or re-time existing chapters.',
  },
  {
    q: 'Does editing re-encode the audio?',
    a: 'No. Only the chapter markers, tags, and cover change; the audio stream is copied through untouched. That means no quality loss and a near-instant save, even for a long book.',
  },
  {
    q: 'What can I edit?',
    a: 'Chapter titles and start times (add, remove, rename, re-time), the book title, author, narrator, year, and genre, and the cover image (keep, replace, or remove).',
  },
  {
    q: 'Are my files uploaded anywhere?',
    a: 'No. Editing runs entirely inside your browser using a WebAssembly build of FFmpeg. Your audiobook never leaves your device. Open your browser\'s Network tab while saving to verify there are no uploads.',
  },
  {
    q: 'How do I enter chapter times?',
    a: 'As H:MM:SS measured from the start of the book (for example 1:23:45), or plain seconds. The first chapter must start at 0:00:00, and times must increase and stay within the book length.',
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
  { label: 'M4B to MP3', href: '/m4b-to-mp3' },
  { label: 'Merge M4Bs', href: '/merge-m4b' },
  { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3' },
  { label: 'M4B player', href: '/m4b-player' },
]

export default function EditM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Edit M4B chapters &amp; metadata
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Rename, add, remove, or re-time chapters, fix the tags, and swap the cover on an existing
            M4B — right in your browser, without re-encoding the audio.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <M4bEditor />

        <section aria-labelledby="how-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="how-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            How M4B editing works
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Drop a finished M4B and the tool reads its chapters, tags, and cover. Adjust anything —
            chapter titles and times, the book metadata, the cover — then save. Because only the
            markers and metadata change, the audio is copied rather than re-encoded, so there is no
            quality loss and the save is fast. Everything runs locally through a WebAssembly build of
            FFmpeg; nothing is uploaded.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Editing M4B: common questions
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
