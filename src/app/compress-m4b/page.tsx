import type { Metadata } from 'next'
import CompressModeSwitch from '@/components/CompressModeSwitch'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Compress M4B: Shrink Audiobook File Size',
  description:
    'Make your M4B audiobook smaller in your browser. Re-encode to AAC at audiobook bitrates — 64 kbps mono is the sweet spot — for a compact, chaptered M4B. No upload, no signup, no limits.',
  alternates: { canonical: '/compress-m4b' },
  openGraph: {
    title: 'Compress M4B: Shrink Your Audiobook File Size, Free and Private',
    description:
      'Build a compact, chaptered M4B in your browser at audiobook bitrates. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
  twitter: {
    card: 'summary',
    title: 'Compress M4B: Shrink Your Audiobook File Size, Free and Private',
    description:
      'Build a compact, chaptered M4B in your browser at audiobook bitrates. Runs entirely client-side via WebAssembly, so your audio never leaves your device.',
  },
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: Compress M4B',
  description:
    'Free browser-based tool to build a compact, chaptered M4B audiobook at audiobook bitrates. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/compress-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const SIZES = [
  { bitrate: '64 kbps', channel: 'Mono', perHour: '~28 MB', tenHour: '~280 MB', note: 'Audiobook standard' },
  { bitrate: '96 kbps', channel: 'Mono', perHour: '~42 MB', tenHour: '~420 MB', note: 'Speech + light music' },
  { bitrate: '128 kbps', channel: 'Stereo', perHour: '~56 MB', tenHour: '~560 MB', note: 'Rarely needed for speech' },
]

const FAQS = [
  {
    q: 'How small can an M4B audiobook get?',
    a: 'It depends on bitrate and length. At 64 kbps mono — the standard for spoken word — expect roughly 28 MB per hour, so a 10-hour audiobook lands around 280 MB. That is typically 2 to 4 times smaller than the same book encoded at 128 kbps stereo, with no audible difference for narration.',
  },
  {
    q: 'Does compressing an M4B reduce audio quality?',
    a: 'For spoken-word audio, dropping to 64 kbps mono is essentially inaudible — human speech does not need stereo or high bitrates. For recordings with music or sound effects you may prefer 96 kbps. Compression re-encodes the audio, so going very low (below 48 kbps) can start to sound thin.',
  },
  {
    q: 'What bitrate should I use for an audiobook?',
    a: '64 kbps mono is the audiobook standard and the default here. Use 96 kbps if the recording has music or effects you want to preserve, and 128 kbps only if you have a specific reason — it roughly doubles the file size for no real benefit on narration.',
  },
  {
    q: 'I already have a single .m4b file — can I shrink it directly?',
    a: 'Yes. Choose the "Shrink an existing M4B" tab, drop your finished .m4b (or .m4a) in, and pick a lower bitrate. The tool re-encodes only the audio to a smaller AAC bitrate and keeps your chapter markers, cover art, and metadata intact.',
  },
  {
    q: 'Are my files uploaded when I compress them?',
    a: 'No. Everything runs inside your browser using a WebAssembly build of FFmpeg. Your audio never leaves your device. Open your browser\'s Network tab while converting to verify there are no upload requests.',
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
  { label: 'Opus to M4B', href: '/opus-to-m4b' },
]

const TOOLBOX_TOOLS = [
  { label: 'M4B to MP3', href: '/m4b-to-mp3' },
  { label: 'Edit M4B chapters', href: '/edit-m4b-chapters' },
  { label: 'Merge M4Bs', href: '/merge-m4b' },
  { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3' },
  { label: 'M4B player', href: '/m4b-player' },
]

export default function CompressM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Compress M4B
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Shrink an existing M4B audiobook, or build a compact one from separate files — right in
            your browser. Pick a lower bitrate and download a much smaller file, with chapters and
            cover art preserved.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <CompressModeSwitch />

        <section aria-labelledby="size-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="size-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Why M4B files get large — and how small they can be
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            File size comes down to three things: bitrate, whether the audio is mono or stereo, and
            the length of the book. Narration is mono speech, so a low bitrate sounds identical while
            taking a fraction of the space. Here is roughly what to expect at common audiobook
            bitrates.
          </p>

          <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Bitrate</th>
                  <th scope="col" className="px-4 py-2 font-medium">Channel</th>
                  <th scope="col" className="px-4 py-2 font-medium">Per hour</th>
                  <th scope="col" className="px-4 py-2 font-medium">10-hour book</th>
                  <th scope="col" className="px-4 py-2 font-medium">Best for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {SIZES.map((row) => (
                  <tr key={row.bitrate} className="bg-white dark:bg-zinc-950">
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-accent-700 dark:text-accent-400">
                      {row.bitrate}
                    </th>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.channel}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.perHour}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.tenHour}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            For plain narration, <strong className="font-semibold text-zinc-800 dark:text-zinc-200">64 kbps mono</strong> is
            the sweet spot: roughly half the size of 128 kbps stereo with no audible difference.
          </p>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="faq-heading" className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Compress M4B: common questions
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
            Convert audio to M4B
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

        <section aria-labelledby="toolbox-heading" className="mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800">
          <h2 id="toolbox-heading" className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            More M4B tools
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {TOOLBOX_TOOLS.map(({ label, href }) => (
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
