import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          {/* Privacy badge */}
          <div className="flex items-center gap-2 text-sm text-accent-600 dark:text-accent-400">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Your files never leave your browser</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/about" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              About
            </Link>
            <a
              href="https://github.com/sbmuc/mp3tom4b"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/sbmuc/mp3tom4b/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Send feedback
            </a>
            <a
              href="https://buymeacoffee.com/mp3tom4b"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Support this project
            </a>
            <a
              href="https://burcevski.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              Burcevski ICT
            </a>
          </nav>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
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
