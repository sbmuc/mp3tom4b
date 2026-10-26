import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // Real-ffmpeg tests are slow; they run via `npm run test:integration`, and
    // the ones on real audiobooks via `npm run test:real`.
    exclude: ['tests/integration/**', 'tests/realfiles/**', 'node_modules/**'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
