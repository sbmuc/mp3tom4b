import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: {
    default: 'mp3tom4b — Convert MP3 to M4B Audiobook Online, Without Uploading',
    template: '%s — mp3tom4b',
  },
  description:
    'Free browser-based tool to convert MP3, M4A, WAV, FLAC, OGG, and Opus files into chaptered M4B audiobooks. Your files never leave your device.',
  metadataBase: new URL('https://mp3tom4b.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'mp3tom4b — Convert MP3 to M4B Audiobook Online',
    description: 'Free, private, client-side M4B audiobook converter. No uploads. No signup.',
    url: 'https://mp3tom4b.com',
    siteName: 'mp3tom4b',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'mp3tom4b — Convert MP3 to M4B Audiobook Online',
    description: 'Free, private, client-side M4B audiobook converter. No uploads. No signup.',
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
      </body>
    </html>
  )
}
