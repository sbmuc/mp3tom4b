/**
 * Smoke tests for every tool in a real browser: drop small files, run the
 * tool, and check the result the way a visitor would (the ready message, and
 * where it matters the chapters in the preview player). They catch what the
 * Node tests can't: bundling of the ffmpeg worker, headers, browser APIs.
 */
import { expect, test as base } from '@playwright/test'
import { fixture } from './fixtures'

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      // Keep test runs out of the site's statistics (Umami and Vercel Analytics).
      await page.route(/\/(stats|_vercel)\//, (route) => route.fulfill({ status: 204, body: '' }))
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text())
      })
      await use(errors)
      expect(errors, 'errors in the browser console').toEqual([])
    },
    { auto: true },
  ],
})

const PAGES = [
  '/', '/about', '/faq', '/privacy', '/compress-m4b', '/edit-m4b-chapters', '/merge-m4b', '/m4b-to-mp3',
  '/add-chapters-to-mp3', '/m4b-player', '/flac-to-m4b', '/wav-to-m4b', '/m4a-to-m4b', '/ogg-to-m4b', '/opus-to-m4b',
  '/librivox-to-m4b', '/m4b-on-iphone', '/m4b-on-android',
]

test('every page loads with its heading', async ({ page }) => {
  for (const path of PAGES) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await expect(page.locator('h1'), path).toBeVisible()
  }
})

test('the Tools menu lists all seven tools', async ({ page }) => {
  await page.goto('/about')
  await page.getByRole('button', { name: 'Tools' }).click()
  const links = page.locator('header').getByRole('link').filter({ hasNotText: /About|FAQ|GitHub|mp3to/ })
  await expect(links).toHaveCount(7)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Tools' })).toHaveAttribute('aria-expanded', 'false')
})

test('converter: chapter MP3s and a dropped cover become one chaptered M4B', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText(/can.t run the converter/)).toHaveCount(0)
  await page
    .getByLabel('Choose audio files and a cover image')
    .setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3'), fixture('cover.jpg')])
  // The dropped image wins over the art embedded in the MP3s. Check once the
  // tags are read: the dropped cover shows first, the embedded one would only
  // replace it after that.
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await expect(page.getByText('from audio file')).toHaveCount(0)
  await expect(page.getByText('from drop')).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Where to listen' })).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('2 chapters')).toBeVisible()
})

test('converter: Convert with an unreadable file goes to that file', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('Choose audio files and a cover image')
    .setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3'), fixture('broken.mp3')])
  await expect(page.getByText('Could not read this file — remove it to convert')).toBeVisible()
  // The button stays clickable while it's aria-disabled (it says what's
  // missing); Playwright would otherwise wait for it to be enabled.
  await page.getByRole('button', { name: 'Convert to M4B' }).click({ force: true })
  const remove = page.getByRole('button', { name: 'Remove Broken' })
  await expect(remove).toBeFocused()
  await expect(remove).toBeInViewport()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('drop zones say tap instead of drop or click', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Tap to choose audio files and a cover image')).toBeVisible()
    await expect(page.getByText('Drop audio files + cover image, or click to browse')).toBeHidden()
  })
})

test('converter: one long file is offered to Add chapters, with what was typed and the cover', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('long.mp3'), fixture('cover.jpg')])
  await expect(page.getByText('One file becomes one chapter.')).toBeVisible()
  await page.locator('#md-title').fill('Handed Over')
  await page.getByRole('button', { name: 'Add chapters to this file' }).click()
  await expect(page).toHaveURL(/\/add-chapters-to-mp3$/)
  await expect(page.getByText('long.mp3')).toBeVisible()
  await expect(page.locator('#ch-title')).toHaveValue('Handed Over')
  await expect(page.getByText('Using a new cover image.')).toBeVisible()
})

test('compressor: a chaptered M4B gets smaller and keeps its chapters', async ({ page }) => {
  await page.goto('/compress-m4b')
  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('book.m4b'))
  await page.getByRole('button', { name: 'Compress M4B' }).click()
  await expect(page.getByText('Your compressed audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('2 chapters')).toBeVisible()
})

test('M4B to MP3: one MP3 per chapter', async ({ page }) => {
  await page.goto('/m4b-to-mp3')
  await page.getByLabel('Choose an M4B to split into MP3s').setInputFiles(fixture('book.m4b'))
  await page.getByRole('button', { name: 'Split to MP3' }).click()
  await expect(page.getByText('Your 2 MP3 files are ready')).toBeVisible()
})

test('editor: a renamed chapter is saved', async ({ page }) => {
  await page.goto('/edit-m4b-chapters')
  await page.getByLabel('Choose an M4B to edit').setInputFiles(fixture('book.m4b'))
  await page.getByLabel('Chapter title').first().fill('Opening')
  await page.getByRole('button', { name: 'Save M4B' }).click()
  await expect(page.getByText('Your edited audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('Opening').last()).toBeVisible()
})

test('merge: two books become one with all their chapters', async ({ page }) => {
  await page.goto('/merge-m4b')
  await page.getByLabel('Choose M4B files to merge').setInputFiles([fixture('book.m4b'), fixture('book-2.m4b')])
  const merge = page.getByRole('button', { name: 'Merge into one M4B' })
  await expect(merge).toBeEnabled()
  await merge.click()
  await expect(page.getByText('Your merged audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('4 chapters')).toBeVisible()
})

test('add chapters: silence detection finds the pauses and the M4B is made', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page.getByLabel('Choose an audio file to add chapters to').setInputFiles(fixture('pauses.mp3'))
  await page.locator('#min-chapter').fill('0.2')
  await page.getByRole('button', { name: 'Detect from silence' }).click()
  await expect(page.getByText(/Found 2 pauses .* made 3 chapters/)).toBeVisible()
  await page.getByRole('button', { name: 'Create chaptered M4B' }).click()
  await expect(page.getByText('Your chaptered audiobook is ready')).toBeVisible()
})

test('add chapters: a cue sheet dropped with the file gives the chapters and titles', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page
    .getByLabel('Choose an audio file to add chapters to')
    .setInputFiles([fixture('pauses.mp3'), fixture('pauses.cue')])
  await expect(page.getByText('3 chapters from "pauses.cue".')).toBeVisible()
  await expect(page.getByLabel('Chapter title')).toHaveCount(3)
  await expect(page.getByLabel('Chapter title').nth(1)).toHaveValue('The Middle')
  await expect(page.getByLabel('Chapter start time').nth(2)).toHaveValue('0:00:33')
  // The file has no tags, so the sheet's TITLE and PERFORMER fill them.
  await expect(page.locator('#ch-title')).toHaveValue('Cue Book')
  await expect(page.locator('#ch-author')).toHaveValue('Cue Author')
  await page.getByRole('button', { name: 'Create chaptered M4B' }).click()
  await expect(page.getByText('Your chaptered audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('3 chapters')).toBeVisible()
  await expect(page.getByText('The Middle').last()).toBeVisible()
})

test('converter: a file with its cue sheet is offered to Add chapters with those chapters', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('pauses.mp3'), fixture('pauses.cue')])
  await expect(page.getByText('This file has a cue sheet with 3 chapters.')).toBeVisible()
  await page.getByRole('button', { name: 'Add chapters to this file' }).click()
  await expect(page).toHaveURL(/\/add-chapters-to-mp3$/)
  await expect(page.getByLabel('Chapter title').last()).toHaveValue('The End')
})

test('player: plays an M4B and shows its chapters', async ({ page }) => {
  await page.goto('/m4b-player')
  await page.getByLabel('Choose an audiobook to play').setInputFiles(fixture('book.m4b'))
  await expect(page.getByText('2 chapters')).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0)).toBeGreaterThan(0)
})
