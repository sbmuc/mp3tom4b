import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import HowItWorks from '@/components/HowItWorks'
import { FormatLinks, ToolLinks } from '@/components/RelatedLinks'
import { socialMetadata } from '@/lib/seo/social'

export const metadata: Metadata = {
  title: 'OGG to M4B: Convert OGG Vorbis Audio to Audiobook',
  description:
    'Convert OGG Vorbis files to a chaptered M4B audiobook in your browser, with cover art and tags. Free, no upload, no signup, no limits.',
  alternates: { canonical: '/ogg-to-m4b' },
  ...socialMetadata(
    '/ogg-to-m4b',
    'OGG to M4B Converter: Free, Private, No Upload',
    'Drop your OGG files and get a single chaptered M4B audiobook out. Runs entirely in your browser via WebAssembly, so your audio never leaves your device.',
  ),
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: OGG to M4B',
  description:
    'Free browser-based tool to convert OGG Vorbis audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/ogg-to-m4b',
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

        <FormatLinks id="other-formats-heading" heading="Convert other formats to M4B" exclude={['/ogg-to-m4b']} />

        <ToolLinks id="toolbox-heading" heading="More M4B tools" exclude={['/']} />
      </div>
    </>
  )
}
