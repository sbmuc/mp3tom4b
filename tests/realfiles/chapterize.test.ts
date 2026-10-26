/**
 * "Add chapters" on real narration: silence detection on actual speech, then
 * turning one long MP3 into a chaptered M4B.
 */
import { describe, expect, it } from 'vitest'
import { chapterizeFile, detectSilenceChapters } from '@/lib/ffmpeg/chapterize'
import { AZKABAN_MP3, BOOKS, FULL, HAVE_FILES, META, bookInfo, chapterMp3s, realFile } from './files'
import { extractMetadata } from '@/lib/audio/metadata'

describe.skipIf(!HAVE_FILES)('chapterizeFile on real narration', () => {
  it('finds chapter breaks at real pauses and keeps them on the audio', async () => {
    const file = await realFile(FULL ? AZKABAN_MP3 : chapterMp3s(BOOKS.goblet)[0])
    const durationMs = (await extractMetadata(file)).durationMs ?? 0
    const starts = await detectSilenceChapters(file, { minGapMs: 1500, durationMs })
    expect(starts[0]).toBe(0)
    starts.forEach((s, i) => {
      expect(s).toBeLessThan(durationMs)
      if (i > 0) expect(s - starts[i - 1]).toBeGreaterThanOrEqual(60_000)
    })

    // Real narration pauses often; use them, or every 5 minutes if there were none.
    const marks = starts.length > 1 ? starts : Array.from({ length: Math.ceil(durationMs / 300_000) }, (_, i) => i * 300_000)
    const chapters = marks.map((startMs, i) => ({ startMs, title: `Part ${i + 1}` }))
    const book = await bookInfo(await chapterizeFile({ file, chapters, metadata: META, cover: { mode: 'remove' }, bitrate: 64, durationMs }))
    expect(book.chapters.map((c) => c.title)).toEqual(chapters.map((c) => c.title))
    expect(book.seconds).toBeCloseTo(durationMs / 1000, -1)
    // Re-encoding moves markers by a few hundredths at most.
    book.chapters.forEach((c, i) => expect(Math.abs(c.startSec - chapters[i].startMs / 1000)).toBeLessThan(0.5))
  })
})
