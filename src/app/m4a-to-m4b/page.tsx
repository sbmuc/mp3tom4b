import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'M4A to M4B: Convert M4A Audio to Audiobook',
  description:
    'Convert M4A files to a chaptered M4B audiobook in your browser. No upload, no signup, no limits. M4A re-encoded with chapter markers, cover art, and embedded metadata.',
  alternates: { canonical: '/m4a-to-m4b' },
  openGraph: {
    title: 'M4A to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your M4A files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'M4A to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your M4A files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: M4A to M4B',
  description:
    'Free browser-based tool to convert M4A audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com/m4a-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'What is the difference between M4A and M4B?',
    a: 'M4A and M4B use the same AAC audio codec inside an MP4 container; the only difference is the file extension and how players treat them. Players like Apple Books and Plex recognise M4B as an audiobook, which means they remember your playback position and display chapter navigation. M4A files are treated as music and lose those features.',
  },
  {
    q: 'Can I just rename M4A to M4B instead of converting?',
    a: 'Sometimes. If you have a single M4A file with no chapter markers you want to preserve, renaming works. But mp3tom4b does much more: it joins multiple M4A files into one, adds chapter markers at every file boundary, embeds cover art, and writes title/author/narrator metadata into the container. A simple rename cannot do any of that.',
  },
  {
    q: 'I have M4A files from iTunes purchases. Will this work?',
    a: 'If the files are DRM-free (most purchases since 2009 are), yes; they will convert normally. DRM-protected M4A files (FairPlay) cannot be processed by any client-side tool, including this one. Check whether your files play in a non-Apple player to tell them apart.',
  },
  {
    q: 'Are my M4A files uploaded anywhere?',
    a: 'No. Conversion runs entirely inside your browser using a WebAssembly build of FFmpeg. Your files never touch any server. Open the Network tab in your browser\'s developer tools while converting to confirm there are no upload requests.',
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

const OTHER_FORMATS = [
  { label: 'MP3 to M4B', href: '/' },
  { label: 'FLAC to M4B', href: '/flac-to-m4b' },
  { label: 'WAV to M4B', href: '/wav-to-m4b' },
  { label: 'OGG to M4B', href: '/ogg-to-m4b' },
  { label: 'Opus to M4B', href: '/opus-to-m4b' },
]

export default function M4aToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            M4A to M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Turn M4A audio files into a proper chaptered M4B audiobook: the format Apple Books,
            Plex, and other players recognise as a book rather than music.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />
        <HowItWorks />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            M4A to M4B: common questions
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

        <section aria-labelledby="other-formats-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="other-formats-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Convert other formats to M4B
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {OTHER_FORMATS.map(({ label, href }) => (
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
