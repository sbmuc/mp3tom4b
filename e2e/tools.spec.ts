/**
 * Smoke tests for every tool in a real browser: drop small files, run the
 * tool, and check the result the way a visitor would (the ready message, and
 * where it matters the chapters in the preview player). They catch what the
 * Node tests can't: bundling of the ffmpeg worker, headers, browser APIs.
 */
import { readFileSync } from 'node:fs'
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

test('converter: the result opens in the editor', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  await page.getByRole('button', { name: 'Edit chapters & tags' }).click()
  await expect(page).toHaveURL(/\/edit-m4b-chapters$/)
  await expect(page.getByLabel('Chapter title')).toHaveCount(2)
  await expect(page.getByLabel('Chapter title').last()).toHaveValue('Chapter 2')
})

test('converter: shared track numbers are left out of the chapter titles', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('numbered-2.mp3'), fixture('numbered-1.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await expect(page.getByLabel('Chapter title').first()).toHaveValue('Opening')
  await expect(page.getByLabel('Chapter title').last()).toHaveValue('Closing')
})

test('converter: a bitrate above what the files hold is explained', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByText('Show advanced options').click()
  await page.getByRole('radio', { name: /^256 kbps/ }).check()
  await expect(page.getByText(/Your audio is 64 kbps, so a higher bitrate makes the M4B bigger, not better/)).toBeVisible()
  await page.getByRole('button', { name: 'Use 64 kbps' }).click()
  await expect(page.getByRole('radio', { name: /^64 kbps/ })).toBeChecked()
  await expect(page.getByText(/Your audio is 64 kbps/)).toHaveCount(0)
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

test('compressor: after a failed run, the next one in the same tab works', async ({ page, consoleErrors }) => {
  await page.goto('/compress-m4b')
  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('scrambled.m4b'))
  await page.getByRole('button', { name: 'Compress M4B' }).click()
  await expect(page.getByText('Compression failed.')).toBeVisible()
  // The tool logs the failure on purpose; it has to be the only error, and the right kind.
  expect(consoleErrors.splice(0)).toEqual([expect.stringContaining("FFmpegExitError: ffmpeg couldn't decode most of the input")])
  await expect(page.getByRole('link', { name: 'open an issue on GitHub' })).toBeVisible()

  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('book.m4b'))
  await page.getByRole('button', { name: 'Compress M4B' }).click()
  await expect(page.getByText('Your compressed audiobook is ready')).toBeVisible()
})

// Seen in the field: a 541 MB file it couldn't read showed as a book without
// chapters, and Compress failed on it at once, four times over.
test('compressor: a file it cannot read is refused when it is dropped', async ({ page }) => {
  await page.goto('/compress-m4b')
  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('cut-off.m4b'))
  await expect(page.getByText(/Could not read that file\. It may be incomplete/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compress M4B' })).toHaveCount(0)

  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('book.m4b'))
  await page.getByRole('button', { name: 'Compress M4B' }).click()
  await expect(page.getByText('Your compressed audiobook is ready')).toBeVisible()
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

// Issue #17: hear where a found chapter starts before the M4B is made.
test('add chapters: listen where a found chapter starts, before making the M4B', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page.getByLabel('Choose an audio file to add chapters to').setInputFiles(fixture('pauses.mp3'))
  await page.locator('#min-chapter').fill('0.2')
  await page.getByRole('button', { name: 'Detect from silence' }).click()
  await expect(page.getByText(/made 3 chapters/)).toBeVisible()

  const chapters = page.getByRole('region', { name: 'Chapters', exact: true })
  await expect(chapters.getByLabel('Chapter start time').nth(1)).toHaveValue('0:00:16')
  await expect(chapters.getByText('Length 0:16', { exact: true })).toBeVisible() // the first chapter's

  const audio = page.locator('audio').first()
  await chapters.getByRole('button', { name: 'Listen from just before 0:00:16' }).click()
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(14)
  expect(await audio.evaluate((a: HTMLAudioElement) => a.currentTime)).toBeLessThan(16)
  expect(await audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(false)
  await expect(chapters.getByText(/Playing at 0:00:1\d/).first()).toBeVisible()

  await chapters.getByRole('button', { name: 'Pause' }).click()
  await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused)).toBe(true)
  await expect(chapters.getByRole('button', { name: 'Listen from just before 0:00:16' })).toBeVisible()
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

// Seen in the field: an AAC file named .mp3 failed at once, five tries in a row.
test('add chapters: an AAC file named .mp3 gets its chapters too', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page
    .getByLabel('Choose an audio file to add chapters to')
    .setInputFiles([fixture('pauses-aac.mp3'), fixture('pauses.cue')])
  await expect(page.getByText('3 chapters from "pauses.cue".')).toBeVisible()
  await page.getByRole('button', { name: 'Create chaptered M4B' }).click()
  await expect(page.getByText('Your chaptered audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('3 chapters')).toBeVisible()
})

test('add chapters: a cover in the file that cannot be read is left out, not failed on', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page.getByLabel('Choose an audio file to add chapters to').setInputFiles(fixture('bad-cover.mp3'))
  await expect(page.getByText("This file's cover can't be read, so it's left out.")).toBeVisible()
  await page.getByRole('button', { name: 'Create chaptered M4B' }).click()
  await expect(page.getByText('Your chaptered audiobook is ready')).toBeVisible()
})

test('converter: a file with its cue sheet is offered to Add chapters with those chapters', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('pauses.mp3'), fixture('pauses.cue')])
  await expect(page.getByText('This file has a cue sheet with 3 chapters.')).toBeVisible()
  await page.getByRole('button', { name: 'Add chapters to this file' }).click()
  await expect(page).toHaveURL(/\/add-chapters-to-mp3$/)
  await expect(page.getByLabel('Chapter title').last()).toHaveValue('The End')
})

test('player: picks up where you left off', async ({ page }) => {
  await page.goto('/m4b-player')
  await page.getByLabel('Choose an audiobook to play').setInputFiles(fixture('long.mp3'))
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0)).toBeGreaterThan(0)
  await page.evaluate(() => {
    const audio = document.querySelector('audio')!
    audio.currentTime = 300
  })
  await expect(page.getByText(/^5:0\d$/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  await page.reload()
  await page.getByLabel('Choose an audiobook to play').setInputFiles(fixture('long.mp3'))
  await expect(page.getByText(/Picked up where you left off, at 5:0\d\./)).toBeVisible()
  expect(await page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0)).toBeGreaterThanOrEqual(299)
  await page.getByRole('button', { name: 'Start from the beginning' }).click()
  expect(await page.evaluate(() => document.querySelector('audio')?.currentTime ?? -1)).toBeLessThan(1)
})

test('player: plays an M4B and shows its chapters', async ({ page }) => {
  await page.goto('/m4b-player')
  await page.getByLabel('Choose an audiobook to play').setInputFiles(fixture('book.m4b'))
  await expect(page.getByText('2 chapters')).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')?.currentTime ?? 0)).toBeGreaterThan(0)
})

test("converter: when the engine can't be downloaded it says so, and the retry works", async ({ page, context, consoleErrors }) => {
  await context.route(/ffmpeg-core\.wasm/, (r) => r.abort())
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  // It used to stay on "Downloading converter… 2%" for good.
  await expect(page.getByText("The converter couldn't be downloaded.", { exact: false })).toBeVisible()
  // The blocked download and the tool's own log are the expected errors here.
  expect(consoleErrors.splice(0).filter((e) => !/Failed to load resource|EngineLoadError/.test(e))).toEqual([])

  await context.unroute(/ffmpeg-core\.wasm/)
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
})

test('converter: a new title goes onto the M4B without encoding again; a new order needs a new one', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()

  await page.getByLabel('Chapter title').first().fill('Opening')
  await expect(page.getByText(/You changed titles, tags or the cover/)).toBeVisible()
  await page.getByRole('button', { name: 'Update M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('Opening').last()).toBeVisible()

  // Sorting used to leave the old M4B up for download as if it were current.
  await page.getByRole('button', { name: 'Sort Z to A' }).click()
  await expect(page.getByText('Your audiobook is ready')).toHaveCount(0)
  await expect(page.getByText(/Your settings changed/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convert to M4B' })).toBeVisible()
})

test('converter: AAC, WMA and AIFF files convert too', async ({ page }) => {
  await page.goto('/')
  await page
    .getByLabel('Choose audio files and a cover image')
    .setInputFiles([fixture('tone.aac'), fixture('tone.wma'), fixture('tone.aiff')])
  await expect(page.getByText(/^3 files ·/)).toBeVisible()
  // The files have no tags to fill these from.
  await page.locator('#md-title').fill('Formats')
  await page.locator('#md-author').fill('E2E Author')
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('3 chapters')).toBeVisible()
})

test('converter: a DRM book and an M4B are named as such, with links to the M4B tools', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('book.aax'), fixture('book.m4b')])
  await expect(page.getByText(/book\.aax: it's copy-protected \(DRM\)/)).toBeVisible()
  await expect(page.getByText(/book\.m4b: it's already an M4B audiobook/)).toBeVisible()
  await page.getByRole('link', { name: 'Edit chapters', exact: true }).click()
  await expect(page).toHaveURL(/\/edit-m4b-chapters$/)
})

test('converter: 32 kbps MP3s get 32 kbps, not twice the size', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('low-1.mp3'), fixture('low-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await expect(page.getByRole('radio', { name: /^32 kbps/ })).toBeChecked()
  await expect(page.getByText(/Your audio is 32 kbps, so 32 kbps keeps everything in it/)).toBeVisible()
})

test('converter: a chapter that came out much shorter than its file is pointed out', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('damaged.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  await expect(page.getByText(/One chapter came out shorter than its file: “Damaged” is 0:1\d of 0:30/)).toBeVisible()
})

test('compressor: an M4B with MP3 audio inside is compressed', async ({ page }) => {
  await page.goto('/compress-m4b')
  await page.getByLabel('Choose an M4B to compress').setInputFiles(fixture('mp3-inside.m4b'))
  await page.getByRole('button', { name: 'Compress M4B' }).click()
  await expect(page.getByText('Your compressed audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('2 chapters')).toBeVisible()
})

test('add chapters: an M4B starts from the chapters it already has', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page.getByLabel('Choose an audio file to add chapters to').setInputFiles(fixture('book.m4b'))
  await expect(page.getByText('The 2 chapters this file already has.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Chapter title')).toHaveCount(2)
  await expect(page.getByLabel('Chapter title').nth(1)).toHaveValue('Two')
  await expect(page.getByLabel('Chapter start time').nth(1)).toHaveValue('0:00:20')
})

test('converter: any year or full date is taken, and a wrong one blocks Convert', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  const year = page.getByLabel(/^Year or date/)
  const problem = page.getByText('Enter a year (1937) or a date (1937-09-21), or leave it empty.')
  await expect(year).toHaveAttribute('placeholder', 'e.g. 1937 or 1937-09-21')
  await year.fill('185')
  await year.blur()
  await expect(problem).toBeVisible()
  await expect(page.getByText(/To enable: fix the year/)).toBeVisible()
  // aria-disabled, but clickable: the click shows what's wrong (see the unreadable-file test).
  await page.getByRole('button', { name: 'Convert to M4B' }).click({ force: true })
  await expect(year).toBeFocused()
  await year.fill('1851-02-30') // no such day
  await expect(problem).toBeVisible()
  await year.fill('1851')
  await expect(problem).toHaveCount(0)
  await year.fill('1851-10-18') // Moby-Dick's release date (issue #21)
  await expect(problem).toHaveCount(0)
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
})

test('the homepage says twice that files stay in the browser, and gives an email address', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Your files never leave your browser: nothing is uploaded.')).toBeVisible()
  await expect(page.locator('footer').getByText(/Your files never leave your browser/)).toBeVisible()
  await expect(page.locator('footer').getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:/)
})

test.describe('on a phone, the file list', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('leaves room for the chapter title', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
    await expect(page.getByText(/^2 files ·/)).toBeVisible()
    const box = await page.getByLabel('Chapter title').first().boundingBox()
    // It was about 104 px (some ten characters) before.
    expect(box!.width).toBeGreaterThan(180)
    // The duration moves under the title instead of taking a column.
    const row = page.locator('li', { has: page.getByLabel('Chapter title') }).first()
    await expect(row.locator('p').getByText('0:08')).toBeVisible()
  })
})

// A chapter that fails while the others are still encoding: the error has to
// stay up. The stopped workers' last progress used to put the bar back over it.
test('converter: when one chapter fails mid-encode, the error stays', async ({ page, consoleErrors }) => {
  await page.goto('/')
  await page
    .getByLabel('Choose audio files and a cover image')
    .setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3'), fixture('scrambled.m4a')])
  await expect(page.getByText(/^3 files ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Conversion failed.')).toBeVisible()
  await page.waitForTimeout(3000)
  await expect(page.getByText('Conversion failed.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Convert to M4B' })).toBeEnabled()
  expect(consoleErrors.splice(0)).toEqual([expect.stringContaining("couldn't decode most of the input")])
})

// Seen in the field: the cover from the tags failed the conversion at the
// very end, after the whole encode ("The source image could not be decoded").
test('converter: a cover in the tags that cannot be read is left out, and the book is made', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles(fixture('bad-cover.mp3'))
  await expect(page.getByText(/The cover inside "bad-cover\.mp3" couldn't be read, so it was left out/)).toBeVisible()
  await expect(page.getByText('from audio file')).toHaveCount(0)
  await page.locator('#md-title').fill('Broken Cover Book')
  await page.locator('#md-author').fill('E2E Author')
  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
})

test('converter: the cover zone takes a WebP', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()
  await page.getByLabel('Choose a cover image').setInputFiles(fixture('cover.webp'))
  await expect(page.getByAltText('Cover preview')).toBeVisible()
  await expect(page.getByText('from drop')).toHaveCount(0)
})

test('editor: a pasted chapter list, find & replace, and the series and description are saved', async ({ page }) => {
  await page.goto('/edit-m4b-chapters')
  await page.getByLabel('Choose an M4B to edit').setInputFiles(fixture('book.m4b'))
  const chapters = page.getByRole('region', { name: 'Chapters', exact: true })
  await expect(chapters.getByLabel('Chapter title')).toHaveCount(2)

  await chapters.getByRole('button', { name: 'Paste a chapter list' }).click()
  await chapters.getByLabel('Paste a chapter list').fill('Chapters:\n0:00 Book - Opening\n0:15 Book - Middle\n0:30 Book - Ending\n')
  await expect(chapters.getByText('3 chapters with a start time (1 line without a time skipped).')).toBeVisible()
  await chapters.getByRole('button', { name: 'Replace the chapters' }).click()
  await expect(chapters.getByLabel('Chapter start time')).toHaveCount(3)
  await expect(chapters.getByLabel('Chapter start time').nth(1)).toHaveValue('0:00:15')
  await expect(chapters.getByLabel('Chapter title').nth(2)).toHaveValue('Book - Ending')

  // A clean-up in one go, undone; then the same by find & replace.
  await chapters.getByRole('button', { name: 'Find & replace in titles' }).click()
  await chapters.getByRole('button', { name: 'Remove “Book -”' }).click()
  await expect(chapters.getByLabel('Chapter title').first()).toHaveValue('Opening')
  await chapters.getByRole('button', { name: 'Undo' }).click()
  await expect(chapters.getByLabel('Chapter title').first()).toHaveValue('Book - Opening')
  await chapters.getByLabel('Find', { exact: true }).fill('book - ')
  await chapters.getByRole('button', { name: 'Replace in 3 titles' }).click()
  await expect(chapters.getByLabel('Chapter title').nth(1)).toHaveValue('Middle')

  await page.getByRole('button', { name: /Series, disc number and description/ }).click()
  await expect(page.locator('#edit-series')).toBeFocused()
  await page.locator('#edit-series').fill('E2E Series')
  await page.locator('#edit-series-part').fill('2')
  await page.locator('#edit-description').fill('Line one.\n\nLine two.')
  await page.getByRole('button', { name: 'Save M4B' }).click()
  await expect(page.getByText('Your edited audiobook is ready')).toBeVisible()

  // Opened again, the saved file has it all.
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download M4B' }).click()
  const saved = readFileSync(await (await download).path())
  await page.getByRole('button', { name: 'Edit another' }).click()
  await page.getByLabel('Choose an M4B to edit').setInputFiles({ name: 'saved.m4b', mimeType: 'audio/mp4', buffer: saved })
  await expect(chapters.getByLabel('Chapter title')).toHaveCount(3)
  await expect(chapters.getByLabel('Chapter title').nth(2)).toHaveValue('Ending')
  await expect(chapters.getByLabel('Chapter start time').nth(2)).toHaveValue('0:00:30')
  await expect(page.locator('#edit-series')).toHaveValue('E2E Series')
  await expect(page.locator('#edit-series-part')).toHaveValue('2')
  await expect(page.locator('#edit-description')).toHaveValue('Line one.\n\nLine two.')
})

test('add chapters: a pasted list gives the chapters, and titles alone rename them', async ({ page }) => {
  await page.goto('/add-chapters-to-mp3')
  await page.getByLabel('Choose an audio file to add chapters to').setInputFiles(fixture('pauses.mp3'))
  const chapters = page.getByRole('region', { name: 'Chapters', exact: true })
  await chapters.getByRole('button', { name: 'Paste a chapter list' }).click()
  await chapters.getByLabel('Paste a chapter list').fill('[00:00] Start\n[00:16] Middle\n[00:33] End\n[09:00] Too late')
  await chapters.getByRole('button', { name: 'Replace the chapters' }).click()
  await expect(chapters.getByLabel('Chapter start time')).toHaveCount(3)
  await expect(chapters.getByLabel('Chapter start time').nth(2)).toHaveValue('0:00:33')
  await expect(chapters.getByText(/1 chapter was left out: past the end/)).toBeVisible()

  await chapters.getByRole('button', { name: 'Paste a chapter list' }).click()
  await chapters.getByLabel('Paste a chapter list').fill('One\nTwo')
  await expect(chapters.getByText('2 titles for 3 chapters: the last chapter keeps its title.')).toBeVisible()
  await chapters.getByRole('button', { name: 'Use the titles' }).click()
  await expect(chapters.getByLabel('Chapter title').first()).toHaveValue('One')
  await expect(chapters.getByLabel('Chapter title').last()).toHaveValue('End')

  await page.getByRole('button', { name: 'Create chaptered M4B' }).click()
  await expect(page.getByText('Your chaptered audiobook is ready')).toBeVisible()
  await page.getByText('Preview: listen and check the chapters').click()
  await expect(page.getByText('3 chapters')).toBeVisible()
  await expect(page.getByText('Two').last()).toBeVisible()
})

test('converter: pasted titles, a copied list, and the description from iTunes go into the M4B', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // iTunes' answer, as it gives one: the description is HTML.
  await page.route(/itunes\.apple\.com\/search/, (route) =>
    route.fulfill({
      json: {
        resultCount: 1,
        results: [{ collectionId: 7, collectionName: 'E2E Book', artistName: 'E2E Author', releaseDate: '2001-01-01T00:00:00Z', description: '<b>Bold</b> start.<br /><br />Second &amp; last.' }],
      },
    }),
  )
  await page.goto('/')
  await page.getByLabel('Choose audio files and a cover image').setInputFiles([fixture('chapter-1.mp3'), fixture('chapter-2.mp3')])
  await expect(page.getByText(/^2 files ·/)).toBeVisible()

  const list = page.getByRole('region', { name: 'Audio file list' })
  await list.getByRole('button', { name: 'Paste a chapter list' }).click()
  await list.getByLabel('Paste a chapter list').fill('The Beginning\nThe End')
  await list.getByRole('button', { name: 'Use the titles' }).click()
  await expect(list.getByLabel('Chapter title', { exact: true }).last()).toHaveValue('The End')
  await list.getByRole('button', { name: 'Copy the list' }).click()
  await expect(list.getByText('Copied 2 chapters, with their start times.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('0:00:00 The Beginning\n0:00:08 The End')

  await page.getByRole('button', { name: 'Look up online' }).click()
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Use this' }).click()
  await expect(page.locator('#md-description')).toHaveValue('Bold start.\n\nSecond & last.')
  await expect(page.locator('label[for="md-description"]').getByText('from iTunes')).toBeVisible()
  await page.locator('#md-series').fill('E2E Series')
  await page.locator('#md-series-part').fill('3')

  await page.getByRole('button', { name: 'Convert to M4B' }).click()
  await expect(page.getByText('Your audiobook is ready')).toBeVisible()
  // The editor reads them back from the M4B's tags.
  await page.getByRole('button', { name: 'Edit chapters & tags' }).click()
  await expect(page).toHaveURL(/\/edit-m4b-chapters$/)
  await expect(page.getByLabel('Chapter title', { exact: true }).first()).toHaveValue('The Beginning')
  await expect(page.locator('#edit-series')).toHaveValue('E2E Series')
  await expect(page.locator('#edit-series-part')).toHaveValue('3')
  await expect(page.locator('#edit-description')).toHaveValue('Bold start.\n\nSecond & last.')
})

// Issue #21: a book tagged in Mp3tag, with a release date and a disc number.
// Saving it in the editor cut the date to a year and dropped the disc number
// and every other tag the editor has no field for.
test('editor: a release date, a disc number and the tags it has no field for are kept', async ({ page }) => {
  await page.goto('/edit-m4b-chapters')
  await page.getByLabel('Choose an M4B to edit').setInputFiles(fixture('tagged.m4b'))
  await expect(page.locator('#edit-year')).toHaveValue('2024-04-03')
  await expect(page.locator('#edit-disc')).toHaveValue('2') // the details are open: one has a value
  await page.locator('#edit-disc').fill('3/2')
  await expect(page.getByText('Not saved like this: a number like 2, or 2/3 for disc 2 of 3.')).toBeVisible()
  await page.locator('#edit-disc').fill('2/3')
  await page.locator('#edit-title').fill('Tagged Book, Part 2')
  await page.getByRole('button', { name: 'Save M4B' }).click()
  await expect(page.getByText('Your edited audiobook is ready')).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download M4B' }).click()
  const saved = readFileSync(await (await download).path())
  expect(saved.includes(Buffer.from('Kept from Mp3tag'))).toBe(true) // the comment
  expect(saved.includes(Buffer.from('2024 E2E Publisher'))).toBe(true) // the copyright
  await page.getByRole('button', { name: 'Edit another' }).click()
  await page.getByLabel('Choose an M4B to edit').setInputFiles({ name: 'saved.m4b', mimeType: 'audio/mp4', buffer: saved })
  await expect(page.locator('#edit-title')).toHaveValue('Tagged Book, Part 2')
  await expect(page.locator('#edit-year')).toHaveValue('2024-04-03')
  await expect(page.locator('#edit-disc')).toHaveValue('2/3')
})

