import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Slow tests that run the real ffmpeg-core (public/ffmpeg/) in Node.
// `npm run test:integration`; the fast unit suite stays `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
