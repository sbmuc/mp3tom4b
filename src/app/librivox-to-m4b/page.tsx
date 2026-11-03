import type { Metadata } from 'next'
import ConverterTool from '@/components/ConverterTool'
import { GuideFaq, GuideNote, MoreGuides, Steps, guideH2 } from '@/components/Guide'
import { socialMetadata } from '@/lib/seo/social'

const DESCRIPTION =
  'Turn a LibriVox ZIP download into one chaptered M4B audiobook with cover art, in your browser. Drop the ZIP and the cover; nothing is uploaded.'

export const metadata: Metadata = {
  title: 'LibriVox to M4B: Turn LibriVox MP3s into an Audiobook',
  description: DESCRIPTION,
  alternates: { canonical: '/librivox-to-m4b' },
  ...socialMetadata('/librivox-to-m4b', 'LibriVox to M4B: free, private, no upload', DESCRIPTION),
}

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mp3tom4b: LibriVox to M4B',
  description:
    'Free browser-based tool that turns a LibriVox ZIP of MP3s into one chaptered M4B audiobook. Conversion runs entirely client-side; no files are uploaded.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'Any (modern web browser)',
  url: 'https://www.mp3tom4b.com/librivox-to-m4b',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
}

const FAQS = [
  {
    q: 'Can I share the M4B I make?',
    a: 'LibriVox recordings are in the public domain in the USA, so there you can use them however you like, sharing included. Elsewhere, check that the book itself is out of copyright in your country.',
  },
  {
    q: 'The book has several readers. What goes in Narrator?',
    a: 'Group recordings on LibriVox have a different reader for each section. Type the readers\' names, or "LibriVox Volunteers"; it is only a tag, and you can leave it empty.',
  },
  {
    q: 'Which bitrate should I pick?',
    a: 'Keep 64 kbps. The MP3s in the LibriVox ZIP are 64 kbps, so a higher bitrate makes the M4B bigger without making it sound better.',
  },
  {
    q: 'Is the ZIP uploaded?',
    a: 'No. The ZIP is unpacked and converted in your browser, and the M4B is saved straight to your device. Nothing is sent to a server.',
  },
  {
    q: 'Will a long book work?',
    a: 'Usually, on a computer. At 64 kbps an hour of audio is about 29 MB, and putting the book together takes two to three times its size in memory, so a 20-hour book needs about 1.5 GB, which desktop browsers handle.',
  },
]

export default function LibrivoxToM4bPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationLd) }} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <section className="py-10 text-center sm:py-14">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">LibriVox to M4B</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Turn a LibriVox download into one M4B audiobook, with a chapter for every section and the book&apos;s cover.
            Drop the ZIP as you downloaded it.{' '}
            <strong className="font-semibold text-zinc-800 dark:text-zinc-200">Your files never leave your device.</strong>
          </p>
        </section>

        <ConverterTool />

        <div className="mx-auto max-w-3xl text-zinc-700 dark:text-zinc-300">
          <h2 className={guideH2}>How to do it</h2>
          <Steps>
            <li>
              Open the book on librivox.org. If it has a &ldquo;Download M4B&rdquo; link, that&apos;s a ready-made M4B.
              Use this page when there isn&apos;t one, or when you want your own chapter titles, cover or details.
            </li>
            <li>
              Download &ldquo;Whole book (zip file)&rdquo; and the cover (&ldquo;Download cover art&rdquo;). The ZIP holds
              only the MP3s.
            </li>
            <li>
              Drop the ZIP and the cover above. The sections are put in order, and the title and author are read from
              their tags. Section titles usually start with their number (&ldquo;01 - The Happy Prince&rdquo;); click one to change
              it. The readers aren&apos;t in the tags, so type the narrator yourself; they&apos;re listed on the book&apos;s
              page.
            </li>
            <li>Click Convert to M4B and download the result.</li>
          </Steps>
          <GuideNote>
            Tried with <em>The Happy Prince and Other Tales</em> (Oscar Wilde, LibriVox version 2): a 50 MB ZIP of five
            sections, 1 h 45 min in all, became a 52 MB M4B with five chapters and the cover in under half a minute on a
            laptop.
          </GuideNote>

          <GuideFaq heading="LibriVox to M4B: common questions" items={FAQS} />
          <MoreGuides current="/librivox-to-m4b" />
        </div>
      </div>
    </>
  )
}
