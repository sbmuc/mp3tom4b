import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FLAC to M4B — Convert Lossless Audio to Audiobook',
  description:
    'Convert FLAC files to a chaptered M4B audiobook in your browser. No upload, no signup, no limits. Lossless input re-encoded to AAC with chapter markers, cover art, and embedded metadata.',
  alternates: { canonical: '/flac-to-m4b' },
  openGraph: {
    title: 'FLAC to M4B Converter — Free, Private, No Upload',
    description:
      'Drop your FLAC files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly — your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'FLAC to M4B Converter — Free, Private, No Upload',
    description:
      'Drop your FLAC files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly — your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b — FLAC to M4B',
  description:
    'Free browser-based tool to convert FLAC audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com/flac-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Does converting FLAC to M4B lose quality?',
    a: 'Yes — FLAC is lossless and M4B uses AAC, which is lossy. For spoken-word audiobooks the difference is inaudible at 64 kbps; that is the default and the standard for audiobook distribution. If you have music or high-fidelity content, choose 128 kbps in the bitrate selector.',
  },
  {
    q: 'Can I mix FLAC and MP3 files in the same audiobook?',
    a: 'Yes. mp3tom4b re-encodes every input file to AAC before joining them, so mixed formats work fine. Drop FLAC and MP3 files together and they will be combined into one M4B in the order you arrange them.',
  },
  {
    q: 'Why are my FLAC files large but the M4B is small?',
    a: 'FLAC files store audio losslessly, which is much larger than AAC. A 500 MB FLAC audiobook will typically produce an M4B of 100–150 MB at 64 kbps — perfectly normal and the right trade-off for spoken audio.',
  },
  {
    q: 'Are my FLAC files uploaded for conversion?',
    a: 'No. The entire conversion runs in your browser via a WebAssembly build of FFmpeg. Nothing leaves your device. You can verify this by watching the Network tab in your browser\'s developer tools — there are no audio file uploads.',
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
  { label: 'WAV to M4B', href: '/wav-to-m4b' },
  { label: 'M4A to M4B', href: '/m4a-to-m4b' },
  { label: 'OGG to M4B', href: '/ogg-to-m4b' },
  { label: 'Opus to M4B', href: '/opus-to-m4b' },
]

export default function FlacToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            FLAC to M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Convert lossless FLAC audio into a chaptered M4B audiobook — right in your browser.
            Chapter markers, cover art, and embedded metadata are all included.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />
        <HowItWorks />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            FLAC to M4B — common questions
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
