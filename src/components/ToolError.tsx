import { AlertCircle } from 'lucide-react'

interface Props {
  /** "Conversion failed.", "Split failed.", … */
  title: string
  message: string
  onDismiss: () => void
}

/**
 * A tool run that ended in an error: what went wrong, and where to say so if
 * it keeps happening. The report links carry nothing; the user decides what
 * to tell.
 */
export default function ToolError({ title, message, onDismiss }: Props) {
  const linkClass = 'underline hover:text-rose-900 dark:hover:text-rose-100'
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 break-words">{message || 'An unknown error occurred.'}</p>
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          Keeps happening? Let me know what you tried and in which browser:{' '}
          <a href="https://github.com/sbmuc/mp3tom4b/issues/new" target="_blank" rel="noopener noreferrer" className={linkClass}>
            open an issue on GitHub
          </a>{' '}
          or{' '}
          <a href="mailto:sebas.bur@gmail.com" className={linkClass}>
            send an email
          </a>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40"
      >
        Dismiss
      </button>
    </div>
  )
}
