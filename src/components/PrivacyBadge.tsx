import { ShieldCheck } from 'lucide-react'

export default function PrivacyBadge({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-sm text-accent-700 dark:border-accent-800 dark:bg-accent-950 dark:text-accent-300 ${className}`}
    >
      <ShieldCheck size={14} aria-hidden="true" />
      <span>Your files never leave your browser</span>
    </div>
  )
}
