import type { MetadataRoute } from 'next'

const BASE = 'https://www.mp3tom4b.com'

// lastModified is the date a page's content last changed. Bump it when you edit
// that page; a date that moves on every build teaches search engines to ignore it.
// After a production deploy, scripts/indexnow.mjs submits the pages dated today
// or yesterday to IndexNow.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}`, lastModified: '2026-10-26', changeFrequency: 'monthly', priority: 1.0 },
    { url: `${BASE}/about`, lastModified: '2026-05-15', changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`, lastModified: '2026-10-26', changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: '2026-09-05', changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/flac-to-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/wav-to-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/m4a-to-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/ogg-to-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/opus-to-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/compress-m4b`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/m4b-to-mp3`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/edit-m4b-chapters`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/merge-m4b`, lastModified: '2026-10-26', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/add-chapters-to-mp3`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/m4b-player`, lastModified: '2026-10-13', changeFrequency: 'monthly', priority: 0.8 },
  ]
}
