/** @type {import('next').NextConfig} */
const nextConfig = {
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
