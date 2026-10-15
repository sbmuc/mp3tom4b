import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOST, KEY, changedUrls, parseSitemapXml } from '../../scripts/indexnow.mjs'
import sitemap from '@/app/sitemap'

describe('changedUrls', () => {
  const now = new Date('2026-10-15T08:00:00Z')

  it('picks pages last modified today or yesterday (UTC)', () => {
    const entries = [
      { url: 'https://www.mp3tom4b.com/a', lastModified: '2026-10-15' },
      { url: 'https://www.mp3tom4b.com/b', lastModified: '2026-10-14' },
      { url: 'https://www.mp3tom4b.com/c', lastModified: '2026-10-13' },
      { url: 'https://www.mp3tom4b.com/d' },
    ]
    expect(changedUrls(entries, now)).toEqual(['https://www.mp3tom4b.com/a', 'https://www.mp3tom4b.com/b'])
  })

  it('accepts Date values as well as date strings', () => {
    const entries = [{ url: 'https://www.mp3tom4b.com/a', lastModified: new Date('2026-10-14T23:59:00Z') }]
    expect(changedUrls(entries, now)).toEqual(['https://www.mp3tom4b.com/a'])
  })
})

describe('parseSitemapXml', () => {
  it('maps each <loc> to its <lastmod> date', () => {
    const xml = `<urlset>
<url>
<loc>https://www.mp3tom4b.com</loc>
<lastmod>2026-10-13</lastmod>
</url>
<url>
<loc>https://www.mp3tom4b.com/faq</loc>
<lastmod>2026-09-05T00:00:00.000Z</lastmod>
</url>
</urlset>`
    expect(parseSitemapXml(xml)).toEqual(
      new Map([
        ['https://www.mp3tom4b.com', '2026-10-13'],
        ['https://www.mp3tom4b.com/faq', '2026-09-05'],
      ]),
    )
  })
})

describe('IndexNow setup', () => {
  it('serves the key file IndexNow verifies against', () => {
    const file = path.resolve(__dirname, '../../public', `${KEY}.txt`)
    expect(readFileSync(file, 'utf8')).toBe(KEY)
  })

  it('lists only URLs on the submitted host, each with a date', () => {
    // IndexNow rejects a batch (HTTP 422) when any URL is on another host.
    for (const entry of sitemap()) {
      expect(new URL(entry.url).host).toBe(HOST)
      expect(entry.lastModified).toBeTruthy()
    }
  })
})
