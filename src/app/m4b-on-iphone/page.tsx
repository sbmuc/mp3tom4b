import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideFaq, GuideNote, MoreGuides, Steps, guideH2, guideLink } from '@/components/Guide'
import { socialMetadata } from '@/lib/seo/social'

const DESCRIPTION =
  'Get an M4B audiobook onto your iPhone or iPad: sync it into Apple Books from a Mac or a Windows PC, or open it in a free app like BookPlayer without a computer.'

export const metadata: Metadata = {
  title: 'How to Put an M4B Audiobook on iPhone (Apple Books)',
  description: DESCRIPTION,
  alternates: { canonical: '/m4b-on-iphone' },
  ...socialMetadata('/m4b-on-iphone', 'How to put an M4B audiobook on your iPhone', DESCRIPTION),
}

const FAQS = [
  {
    q: 'Can I add an M4B to Apple Books on the iPhone without a computer?',
    a: 'Apple Books gets audiobooks you made yourself from a computer: sync them from a Mac with the Finder or from a Windows PC with iTunes. Without a computer, use an audiobook app that opens files from the Files app, such as BookPlayer.',
  },
  {
    q: 'Will my iPhone remember where I stopped?',
    a: 'Yes. Apple Books and audiobook apps like BookPlayer remember your place in an M4B and show its chapters, so you can pick up where you left off or jump to a chapter.',
  },
  {
    q: 'Does this work on an iPad?',
    a: 'Yes. The steps are the same for an iPad: sync it from the Finder or iTunes, or open the file in an audiobook app from the Files app.',
  },
  {
    q: 'Why did my audiobook end up in Music instead of Books?',
    a: 'Apple decides by the audiobook tag inside the file. Files made with mp3tom4b are tagged as audiobooks. A file that was only renamed from .m4a to .m4b usually isn\'t; open it in the M4B editor on this site and save it, and the saved copy is tagged as an audiobook.',
  },
]

export default function M4bOnIphonePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">How to put an M4B audiobook on your iPhone</h1>
      <p className="mt-4 text-lg">
        An M4B keeps its chapters, its cover and your place in the book on an iPhone or iPad. There are two ways to get
        it there: sync it into Apple Books from a computer, or open it in a free audiobook app straight from the Files
        app.
      </p>
      <GuideNote>
        No M4B yet?{' '}
        <Link href="/" className={guideLink}>
          Make one from your MP3s
        </Link>{' '}
        with chapters and a cover, right in your browser. Nothing is uploaded.
      </GuideNote>

      <h2 className={guideH2}>With a Mac: Apple Books</h2>
      <Steps>
        <li>
          Open the Books app on your Mac and drag the M4B into its window, or choose File › Import. It shows up under
          Audiobooks.
        </li>
        <li>Connect your iPhone with a cable (or over Wi-Fi, once you&apos;ve set that up) and select it in the Finder sidebar.</li>
        <li>
          Click Audiobooks in the bar at the top, tick &ldquo;Sync audiobooks onto&rdquo; your iPhone, choose all
          audiobooks or just this one, and click Apply.
        </li>
        <li>On the iPhone, open Books: the audiobook is in your library, with its chapters.</li>
      </Steps>

      <h2 className={guideH2}>With Windows: iTunes</h2>
      <p className="mt-2">On Windows, Apple handles audiobooks in iTunes, not in the newer Apple Devices app.</p>
      <Steps>
        <li>Install iTunes for Windows and add the M4B to its library with File › Add File to Library.</li>
        <li>Connect the iPhone and click the device button near the top left of the iTunes window.</li>
        <li>Click Audiobooks in the sidebar, tick Sync Audiobooks, choose the book and click Apply.</li>
        <li>On the iPhone, open Books: the audiobook is in your library.</li>
      </Steps>

      <h2 className={guideH2}>Without a computer: an audiobook app</h2>
      <p className="mt-2">
        Audiobook apps such as BookPlayer (free and open source) open M4B files from the Files app, show the chapters,
        and remember where you stopped.
      </p>
      <Steps>
        <li>
          Get the M4B onto your iPhone: AirDrop it from a Mac, or save it to Files from iCloud Drive, Dropbox or Google
          Drive.
        </li>
        <li>Install BookPlayer from the App Store.</li>
        <li>In the Files app, open the M4B&apos;s share menu and choose BookPlayer, or import the file from within BookPlayer.</li>
      </Steps>
      <GuideNote>
        You can make a short M4B on the iPhone itself: Safari saves the download in the Downloads folder in Files. For
        anything longer than about an hour, a computer is faster and has the memory for it.
      </GuideNote>

      <h2 className={guideH2}>If something&apos;s off</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">No chapters?</strong> The file has none. Add
          them with{' '}
          <Link href="/add-chapters-to-mp3" className={guideLink}>
            Add chapters
          </Link>{' '}
          (at the pauses, or every few minutes) and sync the new file.
        </li>
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Wrong title, author or cover?</strong> Fix
          them in the{' '}
          <Link href="/edit-m4b-chapters" className={guideLink}>
            M4B editor
          </Link>
          ; the audio isn&apos;t touched.
        </li>
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Too big for your phone?</strong>{' '}
          <Link href="/compress-m4b" className={guideLink}>
            Compress it
          </Link>{' '}
          to 64 kbps, the usual bitrate for spoken word.
        </li>
      </ul>

      <GuideFaq heading="M4B on iPhone: common questions" items={FAQS} />
      <MoreGuides current="/m4b-on-iphone" />
    </article>
  )
}
