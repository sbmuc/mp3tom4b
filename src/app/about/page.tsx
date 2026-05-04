import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description:
    'mp3tom4b is a free, open-source, browser-based MP3-to-M4B audiobook converter. Files never leave your device.',
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">About mp3tom4b</h1>

      <p className="mt-4 text-lg">
        mp3tom4b is a free, open-source tool that turns a folder of audio files into a single
        chaptered M4B audiobook — without uploading anything.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        How it works
      </h2>
      <p className="mt-2">
        The conversion happens inside your browser via a WebAssembly build of FFmpeg. When you drop
        files in, they are read directly from your disk by your browser, processed locally, and the
        finished M4B is offered as a download. No bytes touch any server we operate.
      </p>
      <p className="mt-2">
        You can verify this by opening your browser&apos;s network tab while converting — you&apos;ll see no
        upload traffic. The full source code is published on{' '}
        <a
          href="https://github.com/sbmuc/mp3tom4b"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400"
        >
          GitHub
        </a>{' '}
        so you can audit it yourself.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Why it exists
      </h2>
      <p className="mt-2">
        Every other browser-based M4B converter we could find uploads your audio to a server. Local
        tools exist (ChapterForge, m4b-tool, AudioBookConverter), but they require installation, and
        most either cost money or assume you&apos;re comfortable on the command line. There was a gap
        for a fast, private, no-install option. So we built one.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Who built it</h2>
      <p className="mt-2">
        mp3tom4b is built and maintained by{' '}
        <a
          href="https://burcevski.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400"
        >
          Burcevski ICT
        </a>{' '}
        in Amersfoort, the Netherlands. Questions or feedback?{' '}
        <a
          href="https://github.com/sbmuc/mp3tom4b/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-600 underline hover:text-accent-700 dark:text-accent-400"
        >
          Open an issue on GitHub.
        </a>
      </p>

      <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
        See also: <Link href="/faq" className="underline">FAQ</Link> ·{' '}
        <Link href="/privacy" className="underline">Privacy Policy</Link>
      </p>
    </article>
  )
}
