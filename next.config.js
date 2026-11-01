/** @type {import('next').NextConfig} */
const nextConfig = {
  // Umami's script and its event endpoint, served from our own domain so the
  // browser only ever talks to www.mp3tom4b.com (see layout.tsx).
  async rewrites() {
    return [
      { source: '/stats/script.js', destination: 'https://cloud.umami.is/script.js' },
      { source: '/stats/api/send', destination: 'https://gateway.umami.is/api/send' },
    ]
  },
  async headers() {
    return [
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
