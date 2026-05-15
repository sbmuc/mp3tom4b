import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'WAV to M4B: Convert WAV Audio to Audiobook',
  description:
    'Convert WAV files to a chaptered M4B audiobook in your browser. No upload, no signup, no limits. WAV input re-encoded to AAC with chapter markers, cover art, and embedded metadata.',
  alternates: { canonical: '/wav-to-m4b' },
  openGraph: {
    title: 'WAV to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your WAV files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'WAV to M4B Converter: Free, Private, No Upload',
    description:
      'Drop your WAV files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: WAV to M4B',
  description:
    'Free browser-based tool to convert WAV audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://mp3tom4b.com/wav-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Why are my WAV files so much larger than the output M4B?',
    a: 'WAV stores uncompressed PCM audio, which is very large. The M4B output uses AAC at 64 kbps (the standard for spoken-word audiobooks), which is roughly 15 to 20 times smaller with no audible difference for speech. A 1 GB WAV audiobook typically becomes a 60 to 80 MB M4B.',
  },
  {
    q: 'I recorded my narration as WAV. Can I convert it directly to M4B?',
    a: 'Yes. This is a common use case for self-published authors and home narrators. Drop your WAV chapter files, fill in the title and author fields, optionally add a cover image, and click Convert. The tool will encode each chapter to AAC and join them into a single chaptered M4B.',
  },
  {
    q: 'Can I mix WAV with other formats like MP3?',
    a: 'Yes. Every input file is re-encoded to AAC before being joined, so you can mix WAV, MP3, FLAC, and other supported formats in the same audiobook without any extra steps.',
  },
  {
    q: 'Are my WAV files uploaded anywhere?',
    a: 'No. Conversion runs entirely inside your browser using a WebAssembly build of FFmpeg. Your audio files never leave your device. Open your browser\'s Network tab while converting to verify there are no upload requests.',
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
  { label: 'M4A to M4B', href: '/m4a-to-m4b' },
  { label: 'OGG to M4B', href: '/ogg-to-m4b' },
  { label: 'Opus to M4B', href: '/opus-to-m4b' },
]

export default function WavToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            WAV to M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Convert uncompressed WAV recordings into a chaptered M4B audiobook, right in your
            browser. Perfect for home narrators and self-published authors.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />
        <HowItWorks />

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            WAV to M4B: common questions
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
