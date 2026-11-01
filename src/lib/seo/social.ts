import type { Metadata } from 'next'

// The share image src/app/opengraph-image.tsx (and twitter-image.tsx) draws.
const ALT = 'mp3tom4b: convert MP3 to M4B in your browser, nothing uploaded'
const SIZE = { width: 1200, height: 630 }

/**
 * Open Graph and Twitter tags for one page. When a page sets `openGraph` or
 * `twitter`, Next replaces the root layout's object instead of merging it, so
 * a page that only gave a title and description lost the share image, and a
 * page that gave nothing inherited the homepage's og:url. Every page passes
 * its own path and text through here instead. `path` is resolved against the
 * root layout's metadataBase.
 */
export function socialMetadata(path: string, title: string, description: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'mp3tom4b',
      locale: 'en_US',
      type: 'website',
      images: [{ url: '/opengraph-image', ...SIZE, alt: ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: '/twitter-image', ...SIZE, alt: ALT }],
    },
  }
}
