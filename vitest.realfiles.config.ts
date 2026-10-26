import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Every tool on the owner's own audiobooks (tests/realfiles/files.ts says where
// they live; they're never committed). `npm run test:real` runs a few chapters
// of each in minutes; REAL_FULL=1 runs whole books (about an hour).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/realfiles/**/*.test.ts'],
    // The shipped ffmpeg-core in Node instead of the browser workers.
    setupFiles: ['tests/realfiles/mocks.ts'],
    testTimeout: 3_600_000,
    hookTimeout: 600_000,
    fileParallelism: false,
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
