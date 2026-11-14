import Link from 'next/link'
import {
  AudioLines,
  BookmarkPlus,
  Combine,
  Headphones,
  ListOrdered,
  Minimize2,
  Scissors,
  type LucideIcon,
} from 'lucide-react'

/** Every "… to M4B" page. The converter on the homepage is the MP3 one. */
const FORMATS = [
  { name: 'MP3', href: '/' },
  { name: 'FLAC', href: '/flac-to-m4b' },
  { name: 'WAV', href: '/wav-to-m4b' },
  { name: 'M4A', href: '/m4a-to-m4b' },
  { name: 'OGG', href: '/ogg-to-m4b' },
  { name: 'Opus', href: '/opus-to-m4b' },
]

const TOOLS: { label: string; href: string; hint: string; Icon: LucideIcon }[] = [
  { label: 'MP3 to M4B', href: '/', hint: 'Turn audio files into one audiobook', Icon: AudioLines },
  { label: 'Compress an M4B', href: '/compress-m4b', hint: 'Make an audiobook smaller', Icon: Minimize2 },
  { label: 'M4B to MP3', href: '/m4b-to-mp3', hint: 'Split into one MP3 per chapter', Icon: Scissors },
  { label: 'Edit M4B chapters', href: '/edit-m4b-chapters', hint: 'Chapters, tags and cover', Icon: ListOrdered },
  { label: 'Merge M4Bs', href: '/merge-m4b', hint: 'Join several books into one', Icon: Combine },
  { label: 'Add chapters to MP3', href: '/add-chapters-to-mp3', hint: 'Chapter one long file', Icon: BookmarkPlus },
  { label: 'M4B player', href: '/m4b-player', hint: 'Listen in your browser', Icon: Headphones },
]

interface Props {
  /** The heading's id, for the section's aria-labelledby. */
  id: string
  heading: string
  /** Pages not to list: the page itself, and on format pages the converter (already listed as MP3). */
  exclude: string[]
}

const SECTION = 'mt-16 border-t border-zinc-200 pt-10 dark:border-zinc-800'
const HEADING = 'text-xl font-semibold text-zinc-900 dark:text-zinc-50'
const CARD =
  'group rounded-lg border border-zinc-200 bg-white transition-colors hover:border-accent-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent-500'
const CARD_TITLE =
  'font-medium text-zinc-900 group-hover:text-accent-700 dark:text-zinc-100 dark:group-hover:text-accent-400'

/** The other "… to M4B" pages, as one row of equal buttons (two rows on a phone). */
export function FormatLinks({ id, heading, exclude }: Props) {
  const items = FORMATS.filter((f) => !exclude.includes(f.href))
  return (
    <section aria-labelledby={id} className={SECTION}>
      <h2 id={id} className={HEADING}>
        {heading}
      </h2>
      {/* Six in a row need a little more room than five before "Opus to M4B" wraps. */}
      <ul className={`mt-4 grid grid-cols-3 gap-2 ${items.length > 5 ? 'md:grid-cols-6' : 'sm:grid-cols-5'}`}>
        {items.map(({ name, href }) => (
          <li key={href}>
            <Link href={href} className={`${CARD} block px-2 py-2.5 text-center text-sm`}>
              <span className={CARD_TITLE}>{name}</span>{' '}
              <span className="text-zinc-500 dark:text-zinc-400">to M4B</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The other tools, as cards with an icon and what each one does. */
export function ToolLinks({ id, heading, exclude }: Props) {
  const items = TOOLS.filter((t) => !exclude.includes(t.href))
  return (
    <section aria-labelledby={id} className={SECTION}>
      <h2 id={id} className={HEADING}>
        {heading}
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ label, href, hint, Icon }) => (
          <li key={href}>
            <Link href={href} className={`${CARD} flex h-full items-center gap-3 px-4 py-3`}>
              <Icon size={20} className="shrink-0 text-accent-600 dark:text-accent-400" aria-hidden="true" />
              <span className="text-sm">
                <span className={`block ${CARD_TITLE}`}>{label}</span>
                <span className="block text-zinc-500 dark:text-zinc-400">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
