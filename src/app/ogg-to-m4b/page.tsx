import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'OGG to M4B: Convert OGG Vorbis Audio to Audiobook',
  description:
    'Convert OGG Vorbis files to a chaptered M4B audiobook in your browser. No upload, no signup, no limits. OGG re-encoded to AAC with chapter markers, cover art, and embedded metadata.',
  alternates: { canonical: '/ogg-to-m4b' },
  openGraph: {
    title: 'OGG to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your OGG files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'OGG to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your OGG files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: OGG to M4B',
  description:
    'Free browser-based tool to convert OGG Vorbis audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com/ogg-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Where do OGG audiobooks typically come from?',
    a: 'OGG Vorbis is commonly used by open-source audiobook projects, LibriVox archives, and some Linux-based media players. If you downloaded a free public-domain audiobook or ripped one using open-source tools, it may have come out as OGG. mp3tom4b converts those OGG files into the M4B format that Apple Books, Plex, and most modern players expect.',
  },
  {
    q: 'Will I lose quality converting OGG to M4B?',
    a: 'There is a small quality cost because OGG Vorbis is re-encoded to AAC, which means two lossy codecs in sequence. For spoken-word content the difference is imperceptible at 64 kbps. If your OGG files were encoded at a high bitrate for music, choose 128 kbps in the bitrate selector to minimise the loss.',
  },
  {
    q: 'Can I mix OGG and MP3 files together?',
    a: 'Yes. Every input file, regardless of format, is re-encoded to AAC before being joined, so mixed formats work fine in a single audiobook job.',
  },
  {
    q: 'Are my OGG files uploaded for conversion?',
    a: 'No. Conversion runs entirely in your browser via a WebAssembly build of FFmpeg. Nothing is sent to any server. You can verify this in your browser\'s Network tab while converting.',
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
  { label: 'Opus to M4B', href: '/opus-to-m4b' },
]

export default function OggToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            OGG to M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Convert OGG Vorbis audio files into a chaptered M4B audiobook, right in your browser.
            Ideal for LibriVox downloads and open-source audiobook archives.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />
        <HowItWorks />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            OGG to M4B: common questions
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
