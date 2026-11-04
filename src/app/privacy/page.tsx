import type { Metadata } from 'next'
import { socialMetadata } from '@/lib/seo/social'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'mp3tom4b processes audio files entirely in your browser. No audio data is uploaded, stored, or shared.',
  alternates: { canonical: '/privacy' },
  ...socialMetadata('/privacy', 'mp3tom4b Privacy Policy', 'mp3tom4b processes audio files entirely in your browser. No audio data is uploaded, stored, or shared.'),
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Last updated: 4 November 2026</p>

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
        Your place in a book
      </h2>
      <p className="mt-2">
        The M4B player remembers where you stopped in each book, so it can pick up there next
        time. That position is kept in your browser&apos;s own storage on your device, under a
        scrambled code made from the file&apos;s name and size, and is never sent anywhere. It is
        forgotten when you finish the book; clearing this site&apos;s data in your browser removes
        it too.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Analytics
      </h2>
      <p className="mt-2">
        We count anonymous page views with Vercel Analytics. With Umami we count, per tool,
        whether a conversion finished or failed, with figures like the number of files, the
        bitrate, the length of the audiobook, the output size, how long it took and, when it
        failed, the kind of error (for example &ldquo;out of memory&rdquo;), the encoder&apos;s
        error code and the step it stopped at (such as &ldquo;encoding&rdquo;). Neither sets cookies
        or identifies visitors, and neither ever receives your audio, file names, metadata, or
        cover images. Umami&apos;s requests go to Umami Cloud through this site&apos;s own domain,
        and browsers that send Do Not Track aren&apos;t counted by it. No third-party advertising
        trackers are loaded.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        The conversion engine
      </h2>
      <p className="mt-2">
        On your first conversion, your browser downloads the FFmpeg WebAssembly core (about 31 MB)
        from mp3tom4b&apos;s own domain — it is served directly from this site, not from a
        third-party CDN, and is then cached by your browser for reuse. No data about you or your
        files is sent in that request.
      </p>

      <h2 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Optional metadata lookup
      </h2>
      <p className="mt-2">
        If — and only if — you click &ldquo;Look up online&rdquo; in the metadata section, the
        title, author, and narrator you typed are sent to Apple&apos;s iTunes Search API
        (itunes.apple.com), and, when that returns no match, to Open Library (openlibrary.org), to
        fetch matching book details and cover art. These providers are located outside the EU,
        including in the United States. This is the only situation in which any text you enter
        leaves your device; it is strictly opt-in per search, shown to you beforehand, and your
        audio files and cover images are never involved.
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
        Contact:{' '}
        <a
          href="https://github.com/sbmuc/mp3tom4b/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-700 underline hover:text-accent-800 dark:text-accent-400"
        >
          open a GitHub issue
        </a>
      </p>
    </article>
  )
}
