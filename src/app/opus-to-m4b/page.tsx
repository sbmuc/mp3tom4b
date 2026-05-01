import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Opus to M4B — Convert Opus Audio to Audiobook',
  description:
    'Convert Opus audio files to a chaptered M4B audiobook in your browser. No upload, no signup, no limits. Opus re-encoded to AAC with chapter markers, cover art, and embedded metadata.',
  alternates: { canonical: '/opus-to-m4b' },
  openGraph: {
    title: 'Opus to M4B Converter — Free, Private, No Upload',
    description:
      'Drop your Opus files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly — your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'Opus to M4B Converter — Free, Private, No Upload',
    description:
      'Drop your Opus files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly — your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b — Opus to M4B',
  description:
    'Free browser-based tool to convert Opus audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com/opus-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Where do Opus audiobooks come from?',
    a: 'Opus is a modern open codec developed by Xiph.Org and standardised by the IETF. It is used by some podcast apps, internet radio tools, and open-source recording software. If you recorded narration with Audacity or a similar tool and exported to Opus, or downloaded content from a service that uses Opus, mp3tom4b can package those files into a standard M4B.',
  },
  {
    q: 'Is Opus better quality than AAC at the same bitrate?',
    a: 'For low-bitrate speech, Opus is often slightly better than AAC — but at 64 kbps, which is the standard for audiobooks, both codecs are transparent for spoken audio. The M4B format requires AAC, so mp3tom4b re-encodes Opus to AAC during conversion. The audible difference is negligible.',
  },
  {
    q: 'My Opus files have a .ogg extension. Will they work?',
    a: 'Yes. Opus audio is often stored in an OGG container with a .ogg or .opus extension. mp3tom4b detects the codec from the file content, not just the extension, so files named .ogg that contain Opus audio will be handled correctly.',
  },
  {
    q: 'Are my Opus files uploaded anywhere?',
    a: 'No. Conversion runs entirely in your browser via a WebAssembly build of FFmpeg. Your audio files never leave your device. Open the Network tab in developer tools while converting to confirm — there are no upload requests.',
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
  { label: 'M4A to M4B', href: '/m4a-to-m4b' },
  { label: 'OGG to M4B', href: '/ogg-to-m4b' },
]

export default function OpusToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Opus to M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Convert Opus audio files into a chaptered M4B audiobook — right in your browser.
            Great for podcast recordings, internet radio archives, and open-source narrations.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />
        <HowItWorks />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Opus to M4B — common questions
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
