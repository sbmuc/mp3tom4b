import type { Metadata } from 'next'
import Link from 'next/link'
import { GuideFaq, GuideNote, MoreGuides, Steps, guideH2, guideLink } from '@/components/Guide'
import { socialMetadata } from '@/lib/seo/social'

const DESCRIPTION =
  'Play an M4B audiobook on your Android phone with chapters and resume: copy it over by USB or a cloud drive, then open it in a free player like Voice.'

export const metadata: Metadata = {
  title: 'How to Play M4B Audiobooks on Android (Free Apps)',
  description: DESCRIPTION,
  alternates: { canonical: '/m4b-on-android' },
  ...socialMetadata('/m4b-on-android', 'How to play an M4B audiobook on Android', DESCRIPTION),
}

const FAQS = [
  {
    q: 'Why doesn\'t my music player show the chapters?',
    a: 'Most music players read only the audio in an M4B, not the chapter list inside it, and start from the beginning every time. Audiobook apps such as Voice read the chapters and remember where you stopped.',
  },
  {
    q: 'Which app should I use?',
    a: 'Voice is free and open source, with no ads and nothing behind a paywall, and shows the chapters of an M4B. Smart AudioBook Player is a popular alternative with extra features as a paid upgrade. If you run an Audiobookshelf server, its own app plays your books from there.',
  },
  {
    q: 'Can I make the M4B on my phone?',
    a: 'For a short book, yes: open mp3tom4b in Chrome on the phone and the finished M4B lands in your Downloads folder. For anything longer than about an hour, a computer is faster and has the memory for it.',
  },
]

export default function M4bOnAndroidPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-700 dark:text-zinc-300">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">How to play an M4B audiobook on Android</h1>
      <p className="mt-4 text-lg">
        Android phones play M4B files, but a music app usually ignores the chapters and loses your place. An audiobook
        app keeps both. It takes two steps: get the file onto your phone, then open it in an audiobook player.
      </p>
      <GuideNote>
        No M4B yet?{' '}
        <Link href="/" className={guideLink}>
          Make one from your MP3s
        </Link>{' '}
        with chapters and a cover, right in your browser. Nothing is uploaded.
      </GuideNote>

      <h2 className={guideH2}>1. Get the M4B onto your phone</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">With a USB cable:</strong> connect the phone
          to your computer, choose File transfer in the notification on the phone, and copy the M4B into a folder such as
          Audiobooks.
        </li>
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">With a cloud drive:</strong> put the file in
          Google Drive, Dropbox or OneDrive, download it on the phone, and move it into your Audiobooks folder with the
          Files app.
        </li>
      </ul>
      <GuideNote>
        Give each book its own folder, such as Audiobooks/Author - Title. Most audiobook apps read a folder as one book,
        and your library stays tidy.
      </GuideNote>

      <h2 className={guideH2}>2. Open it in an audiobook player</h2>
      <p className="mt-2">
        Voice is free and open source, on Google Play and F-Droid, with no ads. It shows an M4B&apos;s chapters,
        remembers where you stopped, and has a sleep timer and playback speed.
      </p>
      <Steps>
        <li>Install Voice from Google Play or F-Droid.</li>
        <li>Pick the folder with your audiobooks. Voice shows the books it found before it adds them.</li>
        <li>Tap the book to play it; the chapter list is in the player.</li>
      </Steps>
      <p className="mt-4">
        Prefer something else? Smart AudioBook Player is a popular alternative, with extra features as a paid upgrade.
        If you run an Audiobookshelf server, put the M4B in its audiobooks folder and listen with the Audiobookshelf
        app.
      </p>

      <h2 className={guideH2}>If something&apos;s off</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">No chapters?</strong> The file has none. Add
          them with{' '}
          <Link href="/add-chapters-to-mp3" className={guideLink}>
            Add chapters
          </Link>{' '}
          (at the pauses, or every few minutes) and copy the new file over.
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

      <GuideFaq heading="M4B on Android: common questions" items={FAQS} />
      <MoreGuides current="/m4b-on-android" />
    </article>
  )
}
