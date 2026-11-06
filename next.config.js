/** @type {import('next').NextConfig} */
// Built with webpack (`next build --webpack`), not Next 16's default Turbopack:
// @ffmpeg/ffmpeg starts its worker with `new Worker(new URL(variable,
// import.meta.url))`, which Turbopack can't bundle.

// The Content-Security-Policy makes the browser itself enforce where a page
// may connect, so "nothing is uploaded" doesn't rest on our word alone.
// connect-src is the line that matters: this site, plus the opt-in metadata
// lookup (iTunes Search, Open Library) and the iTunes cover art it offers.
// Every tool runs under it in the browser tests, where a blocked request is a
// console error and fails the test.
const csp = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts; the ffmpeg worker imports the core
  // from a blob: URL and compiles its WebAssembly.
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: https://itunes.apple.com https://openlibrary.org https://*.mzstatic.com",
  "img-src 'self' data: blob: https://*.mzstatic.com",
  // The players play the file from a local blob: URL.
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]

// Preview deploys carry Vercel's toolbar; let it load there, never in production.
if (process.env.VERCEL_ENV === 'preview') {
  const toolbar = {
    'script-src': 'https://vercel.live',
    'connect-src': 'https://vercel.live wss://ws-us3.pusher.com',
    'img-src': 'https://vercel.live https://vercel.com',
    'style-src': 'https://vercel.live',
    'font-src': 'https://vercel.live https://assets.vercel.com',
  }
  for (let i = 0; i < csp.length; i++) {
    const directive = csp[i].split(' ')[0]
    if (toolbar[directive]) csp[i] += ` ${toolbar[directive]}`
  }
  csp.push('frame-src https://vercel.live')
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Features the site never uses. (Screen Wake Lock, which it does use, keeps
  // its default of this site only.)
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Not in development: Next's dev server needs eval and a websocket for
  // hot reloading.
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: csp.join('; ') }] : []),
]

const nextConfig = {
  poweredByHeader: false,
  // Umami's event endpoint, served from our own domain so the browser only
  // ever talks to www.mp3tom4b.com (see layout.tsx). The tracker itself is
  // public/stats/script.js, a pinned copy of cloud.umami.is/script.js: a
  // proxied script could change under us (it did, on 5 November 2026). To
  // update it, download the new one, read it, and replace the file, keeping
  // the header comment's date and hash current.
  async rewrites() {
    return [{ source: '/stats/api/send', destination: 'https://gateway.umami.is/api/send' }]
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // ffmpeg-core is version-pinned in the URL path, so we can cache
        // forever. First-time visitors pay the ~31MB download once; repeat
        // visitors hit their browser cache and never re-fetch.
        source: '/ffmpeg/:version/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
