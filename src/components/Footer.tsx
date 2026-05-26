import Link from 'next/link'

const navLinkClass =
  'inline-flex min-h-[44px] items-center px-2 -mx-2 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100'

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/privacy" className={navLinkClass}>
            Privacy Policy
          </Link>
          <Link href="/about" className={navLinkClass}>
            About
          </Link>
          <a
            href="https://buymeacoffee.com/mp3tom4b"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center px-2 -mx-2 font-medium text-accent-700 transition-colors hover:text-accent-800 dark:text-accent-400 dark:hover:text-accent-300"
          >
            ☕ Support this project
          </a>
          <a
            href="https://github.com/sbmuc/mp3tom4b"
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            GitHub
          </a>
          <a
            href="https://github.com/sbmuc/mp3tom4b/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            Send feedback
          </a>
          <a
            href="https://burcevski.nl"
            target="_blank"
            rel="noopener noreferrer"
            className={navLinkClass}
          >
            Burcevski ICT
          </a>
        </nav>

        <div className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
          © 2026 Burcevski ICT · KvK 74404172 · Built in Amersfoort by{' '}
          <a
            href="https://burcevski.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Burcevski ICT
          </a>
        </div>
      </div>
    </footer>
  )
}
