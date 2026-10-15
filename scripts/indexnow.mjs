// Tells IndexNow which pages a production deploy changed, so Bing (and the
// engines that use its index: DuckDuckGo, Yahoo, Ecosia) recrawl them now
// instead of on their own monthly schedule. Only public page URLs are sent.
//
// Run by .github/workflows/indexnow.yml once Vercel reports a successful
// production deploy. A page counts as changed when its lastModified in
// src/app/sitemap.ts is today or yesterday (UTC).

import { pathToFileURL } from 'node:url'
import sitemap from '../src/app/sitemap.ts'

export const HOST = 'www.mp3tom4b.com'
// Public by design: IndexNow checks it against https://HOST/KEY.txt.
export const KEY = '78e41409c1d17e1f0b3fa6ef942ad1c3'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const DAY_MS = 24 * 60 * 60 * 1000

const day = (value) => new Date(value).toISOString().slice(0, 10)

/** URLs whose lastModified is on `now`'s UTC date or the day before. */
export function changedUrls(entries, now = new Date()) {
  const cutoff = day(now.getTime() - DAY_MS)
  return entries.filter((e) => e.lastModified && day(e.lastModified) >= cutoff).map((e) => e.url)
}

/** <loc> → <lastmod> date from a sitemap.xml body. */
export function parseSitemapXml(xml) {
  const dates = new Map()
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    dates.set(m[1], day(m[2]))
  }
  return dates
}

// Vercel reports success once the deploy is ready; wait until the production
// domain serves this deploy's sitemap, so the crawler fetches the new pages.
async function waitUntilLive(entries) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`https://${HOST}/sitemap.xml`)
    if (res.ok) {
      const live = parseSitemapXml(await res.text())
      if (entries.every((e) => live.get(e.url) === day(e.lastModified))) return
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000))
  }
  throw new Error(`https://${HOST}/sitemap.xml still doesn't match this deploy after 5 minutes.`)
}

async function main() {
  const entries = sitemap()
  const urls = changedUrls(entries)
  if (urls.length === 0) {
    console.log('No page has a lastModified of today or yesterday; nothing to submit.')
    return
  }
  await waitUntilLive(entries)

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  })
  // 200: accepted. 202: accepted, key verification still pending.
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`)
  }
  console.log(`IndexNow accepted ${urls.length} URL(s) (HTTP ${res.status}):\n${urls.join('\n')}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
