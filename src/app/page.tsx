import Link from 'next/link'
import { Minimize2 } from 'lucide-react'
import ConverterTool from '@/components/ConverterTool'
import HeroSection from '@/components/HeroSection'
import HowItWorks from '@/components/HowItWorks'
import WhyMp3ToM4b from '@/components/WhyMp3ToM4b'

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b',
  description:
    'Free browser-based tool to convert MP3, M4A, WAV, FLAC, OGG, and Opus audio files into chaptered M4B audiobooks. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Burcevski ICT',
    url: 'https://burcevski.nl',
  },
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }}
      />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <HeroSection />

        <ConverterTool />

        <Link
          href="/compress-m4b"
          className="mt-6 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-accent-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent-500"
        >
          <Minimize2 size={20} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Already have an M4B that is too big?
            </span>{' '}
            Shrink an existing audiobook to a smaller file — chapters and cover kept.
          </span>
          <span className="ml-auto shrink-0 font-medium text-accent-600 dark:text-accent-400" aria-hidden="true">
            →
          </span>
        </Link>

        <HowItWorks />
        <WhyMp3ToM4b />

        <section
          aria-labelledby="formats-heading"
          className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800"
        >
          <h2 id="formats-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Converting a specific format?
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {[
              { label: 'FLAC to M4B', href: '/flac-to-m4b' },
              { label: 'WAV to M4B', href: '/wav-to-m4b' },
              { label: 'M4A to M4B', href: '/m4a-to-m4b' },
              { label: 'OGG to M4B', href: '/ogg-to-m4b' },
              { label: 'Opus to M4B', href: '/opus-to-m4b' },
              { label: 'Compress an M4B', href: '/compress-m4b' },
              { label: 'M4B to MP3', href: '/m4b-to-mp3' },
              { label: 'Edit M4B chapters', href: '/edit-m4b-chapters' },
              { label: 'Merge M4Bs', href: '/merge-m4b' },
              { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3' },
              { label: 'M4B player', href: '/m4b-player' },
            ].map(({ label, href }) => (
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
