import type { MetadataRoute } from 'next'

const BASE = 'https://www.mp3tom4b.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: `${BASE}`, lastModified, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${BASE}/about`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/flac-to-m4b`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/wav-to-m4b`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/m4a-to-m4b`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/ogg-to-m4b`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/opus-to-m4b`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
