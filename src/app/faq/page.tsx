import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Answers to common questions about mp3tom4b: what M4B is, why it is private, supported file types, file size limits, browser support, offline use.',
  alternates: { canonical: '/faq' },
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is an M4B file?',
    a: 'M4B is an audio container based on MP4 that supports embedded chapter markers, cover art, and bookmarking. Apple Books, Plex, and most modern audiobook players treat M4B files as audiobooks rather than music — they remember playback position and group correctly in your library.',
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
    a: 'MP3, M4A, WAV, FLAC, OGG, and Opus. Mixed formats in a single audiobook are fine — each file is re-encoded to AAC at the bitrate you choose before being joined.',
  },
  {
    q: 'Are there file size limits?',
    a: 'There are no artificial limits — only what your browser can hold in memory. On modern desktop browsers, audiobooks up to roughly 12 hours / 1.5 GB of input usually convert without trouble. Larger jobs may run out of memory; in that case, split into shorter sessions.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Recent versions of Chrome, Edge, Firefox, Safari, Brave, and Arc on desktop. Mobile Safari and Chrome on tablets work for short jobs. On phones, conversion is technically possible but slow; a desktop browser is recommended for anything beyond an hour of audio.',
  },
  {
    q: 'What happens if I close the tab during conversion?',
    a: 'The conversion stops and any progress is lost — there is nothing on a server to resume from, because no server is involved. Just keep the tab open until the download appears. You can use other tabs or apps in the meantime.',
  },
  {
    q: 'Can I use this offline?',
    a: 'Mostly yes. After the first conversion, the FFmpeg WebAssembly core is cached by your browser, so subsequent conversions work without an internet connection. The first load needs network access to fetch the wasm binary.',
  },
  {
    q: 'Why is the narrator missing from online lookup results?',
    a: 'Audiobook narrator information isn\'t consistently exposed by the metadata sources we query. iTunes audiobook entries usually only carry the author in their public search API, and Open Library is book-centric and rarely lists narrators at all. If you type a narrator into the form yourself, mp3tom4b keeps that value as you entered it — online lookups will not overwrite a narrator field you have filled in. The "Verify metadata" step also has a fallback that searches with the narrator as a stand-in author, which can find the right edition even when the narrator field itself isn\'t returned.',
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
          {FAQS.map(({ q, a }) => (
            <div key={q} className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <dt className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </>
  )
}
