import type { Metadata } from 'next'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: {
    default: 'Convert MP3 to M4B Audiobook Online — Free, No Upload',
    template: '%s · mp3tom4b',
  },
  description:
    'Convert MP3, M4A, WAV, FLAC, OGG & Opus into a chaptered M4B audiobook — or shrink an existing M4B to a smaller file. Free, private, and never uploaded.',
  metadataBase: new URL('https://www.mp3tom4b.com'),
  alternates: {
    canonical: '/',
  },
  verification: {
    google: 'a7w95AL0n5Q448kZGk',
  },
  openGraph: {
    title: 'mp3tom4b: Convert MP3 to M4B Audiobook Online',
    description: 'Free, private, client-side M4B audiobook converter and compressor. No uploads. No signup.',
    url: 'https://www.mp3tom4b.com',
    siteName: 'mp3tom4b',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mp3tom4b: Convert MP3 to M4B Audiobook Online',
    description: 'Free, private, client-side M4B audiobook converter and compressor. No uploads. No signup.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <Analytics />
        {/* Umami: the cookieless usage events in lib/analytics.ts, nothing else.
            It's served from our own domain (/stats is rewritten to Umami Cloud in
            next.config.js) so blockers don't drop the events, but then Umami sees
            Vercel's IP instead of the visitor's: its countries and visitor counts
            would be wrong, so its automatic page views are off and Vercel
            Analytics above counts visitors. Only the production host is counted,
            and Do Not Track is honoured. */}
        <Script
          src="/stats/script.js"
          data-website-id="6821279d-906b-4db1-ad00-a37a7ab2b35a"
          data-host-url="/stats"
          data-domains="www.mp3tom4b.com"
          data-do-not-track="true"
          data-auto-track="false"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
