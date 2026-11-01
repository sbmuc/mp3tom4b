export default function HeroSection() {
  return (
    <section className="py-10 text-center sm:py-14">
      {/* The wordmark looks like the heading; the H1 is the sentence that says what the page does. */}
      <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
        <span className="text-zinc-900 dark:text-zinc-100">mp3to</span>
        <span className="text-accent-700 dark:text-accent-500">m4b</span>
      </p>
      <h1 className="mx-auto mt-4 max-w-2xl text-lg font-normal text-zinc-700 dark:text-zinc-300 sm:text-xl">
        Convert MP3 to M4B audiobooks <strong className="font-semibold text-zinc-900 dark:text-zinc-50">without uploading a single byte</strong>.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
        Drag your files in, add a cover and chapters, get a single tagged M4B out.
      </p>
    </section>
  )
}
