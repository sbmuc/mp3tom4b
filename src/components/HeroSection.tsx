import PrivacyBadge from './PrivacyBadge'

export default function HeroSection() {
  return (
    <section className="py-10 text-center sm:py-14">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
        <span className="text-zinc-900 dark:text-zinc-100">mp3to</span>
        <span className="text-accent-500">m4b</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-700 dark:text-zinc-300 sm:text-xl">
        Convert MP3 to M4B audiobooks <strong className="font-semibold text-zinc-900 dark:text-zinc-50">without uploading a single byte</strong>.
      </p>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
        Drag your files in, add a cover and chapters, get a single tagged M4B out. Also handles M4A, WAV, FLAC, OGG, and Opus.
      </p>
      <div className="mt-5 flex justify-center">
        <PrivacyBadge />
      </div>
    </section>
  )
}
