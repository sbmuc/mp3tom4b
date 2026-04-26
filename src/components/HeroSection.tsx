import PrivacyBadge from './PrivacyBadge'

export default function HeroSection() {
  return (
    <section className="py-10 text-center sm:py-14">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
        <span className="text-zinc-900 dark:text-zinc-100">mp3to</span>
        <span className="text-accent-500">m4b</span>
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
        Convert MP3 to M4B audiobooks right in your browser. Drag your files in, add a cover and
        chapters, get a single tagged M4B out — <strong className="font-semibold text-zinc-800 dark:text-zinc-200">nothing is uploaded</strong>.
      </p>
      <div className="mt-5 flex justify-center">
        <PrivacyBadge />
      </div>
    </section>
  )
}
