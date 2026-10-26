import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers to common questions about mp3tom4b: what M4B is, why it is private, supported file types, file size limits, browser support, offline use.',
  alternates: { canonical: '/faq' },
}

const FAQS: { q: string; a: string; aNode?: ReactNode }[] = [
  {
    q: 'What is an M4B file?',
    a: 'M4B is an audio container based on MP4 that supports embedded chapter markers, cover art, and bookmarking. Apple Books, Plex, and most modern audiobook players treat M4B files as audiobooks rather than music, so they remember playback position and group correctly in your library.',
  },
  {
    q: 'Why convert MP3 to M4B?',
    a: 'A folder of MP3s is fine for music but a poor fit for long-form audiobook listening: no chapters, no resume position, scattered across your library. A single M4B with chapters acts like one tagged audiobook entry, with proper position memory and chapter navigation.',
  },
  {
    q: 'Is this really private? Are my files uploaded?',
    a: 'The entire conversion runs locally in your browser using a WebAssembly build of FFmpeg. You can confirm this by opening your browser\'s network tab while converting: there are no audio uploads. The source code is published on GitHub so you can audit it.',
  },
  {
    q: 'Which audio file types are supported?',
    a: 'MP3, M4A, WAV, FLAC, OGG, and Opus. Mixed formats in a single audiobook are fine, because each file is re-encoded to AAC at the bitrate you choose before being joined.',
  },
  {
    q: 'Can I drop a ZIP file?',
    a: 'Yes. Drop the ZIP as you downloaded it, from Google Drive, Dropbox, LibriVox or elsewhere, and the audio files inside are unpacked right in your browser, in folder and name order, with a cover image if there is one. Google Drive splits big downloads into several ZIPs; drop them all at once. The merge tool takes ZIPs of M4B files the same way. Unpacking happens on your device, so nothing is uploaded for this either.',
  },
  {
    q: 'Are there file size limits?',
    a: 'There are no artificial limits, only what your browser can hold in memory. When you convert to M4B, your source files are read from your disk as they are needed, so their size hardly matters. What counts is the finished audiobook: putting it together takes two to three times its size in memory. At 64 kbps an hour of audio is about 29 MB, so a 20-hour book (about 580 MB) needs around 1.5 GB, which desktop browsers handle. At 128 kbps the same book needs about twice as much.',
  },
  {
    q: 'What if my browser runs out of memory?',
    a: 'Close other tabs and apps, then convert again. If it still fails, choose 64 kbps (half the memory of 128 kbps, and the usual bitrate for spoken word), use a desktop browser rather than a phone or tablet, or convert the book in two parts. How many files you drop in makes no difference; only the length of the book and the bitrate do.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Recent versions of Chrome, Edge, Firefox, Safari, Brave, and Arc on desktop. Mobile Safari and Chrome on tablets work for short jobs. On phones, conversion is technically possible but slow; a desktop browser is recommended for anything beyond an hour of audio.',
  },
  {
    q: 'What happens if I close the tab during conversion?',
    a: 'The conversion stops and any progress is lost. There is nothing on a server to resume from, because no server is involved. Just keep the tab open until the download appears. You can use other tabs or apps in the meantime.',
  },
  {
    q: 'Can I use this offline?',
    a: 'Largely, yes. The conversion itself never contacts a server — it all runs on your device. After the first load your browser caches the app and the FFmpeg WebAssembly core, so repeat visits and conversions usually work without a connection. This relies on the browser cache rather than a full offline install, so treat it as best-effort rather than guaranteed.',
  },
  {
    q: 'Why is the narrator missing from online lookup results?',
    a: 'Narrator data isn\'t reliably available from the public sources we query (iTunes and Open Library). Type the narrator into the form manually; online lookups never overwrite a value you\'ve filled in.',
  },
  {
    q: 'Is mp3tom4b really free?',
    a: 'Yes. It\'s free forever, no ads, no account required, no file size limits beyond what your browser can handle. The tool has no paid tier. If it\'s saved you time and you\'d like to support the hosting costs, you can optionally buy me a coffee, but it\'s never required and the tool works identically either way.',
    aNode: (
      <>
        Yes. It&apos;s free forever, no ads, no account required, no file size limits beyond what your browser can handle. The tool has no paid tier. If it&apos;s saved you time and you&apos;d like to support the hosting costs, you can optionally{' '}
        <a
          href="https://buymeacoffee.com/mp3tom4b"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          buy me a coffee
        </a>
        , but it&apos;s never required and the tool works identically either way.
      </>
    ),
  },
]

export default function FaqPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Frequently asked questions</h1>
        <dl className="mt-8 space-y-6">
          {FAQS.map(({ q, a, aNode }) => (
            <div key={q} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed">{aNode ?? a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </>
  )
}
