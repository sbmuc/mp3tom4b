import { defineConfig, devices } from '@playwright/test'

/**
 * Browser smoke tests (e2e/): every tool, in a real Chrome, on small generated
 * files. `npm run test:e2e` builds nothing itself: against a local server it
 * starts `next start` on a build you've made (`npm run build`); with BASE_URL
 * set (the daily and post-deploy check) it tests that site instead.
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // The first test in a run downloads the ~31 MB engine.
  timeout: 180_000,
  expect: { timeout: 90_000 },
  // One at a time: each tool runs ffmpeg in workers and is heavy on CPU.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx next start -p 3100',
        url: 'http://localhost:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
