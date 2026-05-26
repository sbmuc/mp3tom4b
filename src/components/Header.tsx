import Link from 'next/link'

const navLinkClass =
  'inline-flex min-h-[44px] items-center px-2 -mx-1 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100'

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <Link
          href="/"
          className="group inline-flex min-h-[44px] items-baseline gap-0.5 text-xl font-semibold tracking-tight"
        >
          <span className="text-zinc-900 dark:text-zinc-100">mp3to</span>
          <span className="text-accent-500">m4b</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/about" className={navLinkClass}>
            About
          </Link>
          <Link href="/faq" className={navLinkClass}>
            FAQ
          </Link>
          <a
            href="https://github.com/sbmuc/mp3tom4b"
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
            aria-label="GitHub repository"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  )
}
