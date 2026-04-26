import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'mp3tom4b processes audio files entirely in your browser. No audio data is uploaded, stored, or shared.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">Last updated: 26 April 2026</p>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Your audio files
      </h2>
      <p className="mt-2">
        Audio files you drop into mp3tom4b are processed entirely in your browser via WebAssembly.
        They are never uploaded, transmitted, stored, or shared. The only place they exist outside
        your device is wherever you choose to save the resulting M4B.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Cover images and metadata
      </h2>
      <p className="mt-2">
        Cover images and the metadata you type (title, author, narrator, year, genre) are also
        processed only in your browser and end up only in the M4B file you download.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Analytics
      </h2>
      <p className="mt-2">
        We use Vercel Analytics to count anonymous page views. It does not set cookies, does not
        identify visitors, and never receives any of your audio, metadata, or cover images. No
        third-party advertising trackers are loaded.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        External resources
      </h2>
      <p className="mt-2">
        On first use, your browser downloads the FFmpeg WebAssembly core from a public CDN
        (unpkg.com). This is a one-time fetch of a publicly available binary; no data about you or
        your files is sent in the request.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Cookies
      </h2>
      <p className="mt-2">
        mp3tom4b sets no cookies. No login. No account. Nothing to consent to.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Contact
      </h2>
      <p className="mt-2">
        Operator: Burcevski ICT (KvK 74404172), Amersfoort, the Netherlands.<br />
        Email:{' '}
        <a
          href="mailto:sebas.bur@gmail.com"
          className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400"
        >
          sebas.bur@gmail.com
        </a>
      </p>
    </article>
  )
}
