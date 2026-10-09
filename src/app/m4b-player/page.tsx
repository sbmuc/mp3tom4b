import type { Metadata } from 'next'
import M4bPlayer from '@/components/M4bPlayer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'M4B Player Online: Play Audiobooks in Your Browser',
  description:
    'Play an M4B audiobook right in your browser, with its chapters, cover art, and playback speed. Nothing to install, works on Windows, Mac, Linux, and Chromebook. No upload — the file never leaves your device.',
  alternates: { canonical: '/m4b-player' },
  openGraph: {
    title: 'M4B Player Online: Free, Private, Nothing to Install',
    description:
      'Open and play M4B audiobooks in your browser with chapter navigation and speed control. The file plays from your device and is never uploaded.',
  },
  twitter: {
    card: 'summary',
    title: 'M4B Player Online: Free, Private, Nothing to Install',
    description:
      'Open and play M4B audiobooks in your browser with chapter navigation and speed control. The file plays from your device and is never uploaded.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: M4B Player',
  description:
    'Free browser-based player for M4B audiobooks with chapter navigation, cover art, and playback speed. The file plays locally; nothing is uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/m4b-player',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'How do I open an M4B file?',
    a: 'Drop it on this page and it plays right away, with its chapters, cover, and a speed control. An M4B is an MP4 audio file with chapter markers, so on a Mac or iPhone Apple Books opens it too, and on other systems a media player such as VLC plays it.',
  },
  {
    q: 'Can I play M4B files on Windows?',
    a: 'Yes. Open this page in Chrome, Edge, or Firefox and drop the file; there is nothing to install. Windows has no audiobook app built in, so double-clicking an M4B often opens a music app that ignores the chapters, if it opens at all.',
  },
  {
    q: 'Is my audiobook uploaded?',
    a: 'No. Your browser plays the file straight from your device with its own built-in audio player. Nothing about the file is sent to a server, and nothing is kept after you close the tab.',
  },
  {
    q: 'Why don\'t I see any chapters?',
    a: 'The file has no chapter markers, so it plays as one long track. Add them to an M4B with the chapter editor, or turn a long MP3 into a chaptered M4B with "Add chapters to MP3".',
  },
  {
    q: 'Does it remember where I stopped?',
    a: 'No. The player stores nothing between visits, so note the chapter if you want to come back to it. For everyday listening, an audiobook app on your phone (such as Apple Books or BookPlayer on iPhone) remembers your place and works offline.',
  },
  {
    q: 'Can I change the playback speed?',
    a: 'Yes, from 0.75× to 2×, and voices keep their natural pitch. You can also skip back 15 seconds, forward 30 seconds, or jump between chapters, including with your keyboard\'s media keys or your phone\'s lock screen.',
  },
  {
    q: 'Which files does it play?',
    a: 'M4B, M4A, and MP3. It uses your browser\'s own audio support, so AAC and MP3 audiobooks play in current Chrome, Edge, Firefox, and Safari. Chapters are read from M4B/M4A chapter markers and from MP3 ID3 chapters.',
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
  { label: 'Edit M4B chapters', href: '/edit-m4b-chapters' },
  { label: 'Merge M4Bs', href: '/merge-m4b' },
  { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3' },
]

export default function M4bPlayerPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">M4B Player</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Play an M4B audiobook right in your browser, with its chapters, cover art, and playback
            speed. Nothing to install.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your file never leaves your device.</strong>
          </p>
        </section>

        <M4bPlayer />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            M4B player: common questions
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

        <section aria-labelledby="toolbox-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="toolbox-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
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
