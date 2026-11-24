/**
 * Test files for the browser smoke tests, made with the site's own
 * ffmpeg-core in Node (tests/integration/nodeFFmpeg.ts) so nothing binary is
 * committed: sine tones with tags, a cover, and two chaptered M4Bs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NodeFFmpeg } from '../tests/integration/nodeFFmpeg'

export const FIXTURE_DIR = path.join(os.tmpdir(), 'mp3tom4b-e2e')
export const fixture = (name: string) => path.join(FIXTURE_DIR, name)

const META = (title: string) =>
  `;FFMETADATA1\ntitle=${title}\nalbum=${title}\nartist=E2E Author\n` +
  '[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=20000\ntitle=One\n' +
  '[CHAPTER]\nTIMEBASE=1/1000\nSTART=20000\nEND=40000\ntitle=Two\n'

export async function makeFixtures(): Promise<void> {
  mkdirSync(FIXTURE_DIR, { recursive: true })
  const ff = await NodeFFmpeg.create()
  const make = async (args: string[], out: string) => {
    const { ret } = await ff.run([...args, out])
    if (ret !== 0) throw new Error(`could not make ${out}`)
    writeFileSync(fixture(out), await ff.readFile(out))
  }
  // Covers use the standard Huffman tables for the reason in src/lib/ffmpeg/cover.ts.
  const jpeg = ['-frames:v', '1', '-c:v', 'mjpeg', '-huffman', 'default']

  await make(['-f', 'lavfi', '-i', 'smptebars=size=600x600:rate=1', ...jpeg], 'cover.jpg')
  await make(['-f', 'lavfi', '-i', 'testsrc=size=300x300:rate=1', ...jpeg], 'embedded.jpg')

  // Two chapter MP3s with tags and their own embedded art (a dropped cover must win).
  for (const n of [1, 2]) {
    await make(
      [
        '-f', 'lavfi', '-i', `sine=frequency=${300 + n * 100}:duration=8`, '-i', 'embedded.jpg',
        '-map', '0:a', '-map', '1:v', '-c:a', 'libmp3lame', '-b:a', '64k', '-c:v', 'copy',
        '-disposition:v', 'attached_pic', '-id3v2_version', '3',
        '-metadata', `title=Chapter ${n}`, '-metadata', 'artist=E2E Author', '-metadata', 'album=E2E Book',
      ],
      `chapter-${n}.mp3`,
    )
  }

  // Two short MP3s whose tag titles carry track numbers, as LibriVox's do.
  for (const [n, title] of [[1, '01 - Opening'], [2, '02 - Closing']] as const) {
    await make(
      ['-f', 'lavfi', '-i', `sine=frequency=${500 + n * 50}:duration=3`, '-c:a', 'libmp3lame', '-b:a', '64k',
        '-id3v2_version', '3', '-metadata', `title=${title}`, '-metadata', 'artist=E2E Author', '-metadata', 'album=Numbered Book'],
      `numbered-${n}.mp3`,
    )
  }

  // Two 40 s M4Bs with two chapters and a cover each.
  for (const [name, hz] of [['book.m4b', 440], ['book-2.m4b', 550]] as const) {
    await ff.writeFile('meta.txt', META(name === 'book.m4b' ? 'E2E Book' : 'E2E Book Two'))
    await make(
      [
        '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=20`, '-f', 'lavfi', '-i', `sine=frequency=${hz + 220}:duration=20`,
        '-i', 'cover.jpg', '-i', 'meta.txt',
        '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[a]', '-map', '[a]', '-map', '2',
        '-map_metadata', '3', '-map_chapters', '3',
        '-c:a', 'aac', '-b:a', '128k', '-c:v', 'mjpeg', '-huffman', 'default', '-disposition:v', 'attached_pic', '-f', 'mp4',
      ],
      name,
    )
  }

  // The same book with MP3 audio inside, as some tools make them: the
  // compressor's split refused it ("ffmpeg exited with code 1").
  await ff.writeFile('book.m4b', readFileSync(fixture('book.m4b')))
  await make(
    ['-i', 'book.m4b', '-map', '0:a', '-c:a', 'libmp3lame', '-b:a', '128k', '-map_metadata', '0', '-map_chapters', '0', '-f', 'mp4'],
    'mp3-inside.m4b',
  )

  // One 16-minute file, longer than the converter's "one long file" threshold.
  // 8 kHz mono at 8 kbps keeps it under 1 MB and quick to make.
  await make(
    ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=960:sample_rate=8000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '8k'],
    'long.mp3',
  )

  // Two 32 kbps mono MP3s, as old rips are: the converter should match them, not double them.
  for (const n of [1, 2]) {
    await make(
      ['-f', 'lavfi', '-i', `sine=frequency=${350 + n * 100}:duration=4:sample_rate=22050`, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k'],
      `low-${n}.mp3`,
    )
  }

  // Formats the converter takes besides the original six.
  const tone = (hz: number) => ['-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=3`]
  await make([...tone(300), '-c:a', 'aac', '-f', 'adts'], 'tone.aac')
  await make([...tone(400), '-c:a', 'wmav2', '-f', 'asf'], 'tone.wma')
  await make([...tone(500), '-c:a', 'pcm_s16be', '-f', 'aiff'], 'tone.aiff')

  // A WebP cover, which the cover zone used to ignore without a word.
  await make(['-f', 'lavfi', '-i', 'testsrc=size=400x400:rate=1', '-frames:v', '1', '-c:v', 'libwebp'], 'cover.webp')

  // A 30 s MP3 with its second half scrambled: decodes to about 15 s, without an error.
  await make([...tone(600).map((x) => x.replace('duration=3', 'duration=30')), '-c:a', 'libmp3lame', '-b:a', '64k'], 'damaged.mp3')
  {
    const b = readFileSync(fixture('damaged.mp3'))
    for (let i = Math.floor(b.length / 2); i < b.length; i++) b[i] = (i * 7919) & 0xff
    writeFileSync(fixture('damaged.mp3'), b)
  }

  // Copy-protected books aren't opened; only the name counts here.
  writeFileSync(fixture('book.aax'), Buffer.from('aax '.repeat(100)))

  // An M4B cut off halfway: its header promises audio that isn't there.
  writeFileSync(fixture('cut-off.m4b'), readFileSync(fixture('book.m4b')).subarray(0, 20_000))

  // Not audio at all, but named like it: the converter can't read it.
  writeFileSync(fixture('broken.mp3'), Buffer.from('this is not an mp3 file '.repeat(200)))

  // A cue sheet for pauses.mp3 as a ripper would write it: Windows line ends,
  // named after a WAV, chapters at the middle of each pause (16.25 s, 33.75 s).
  writeFileSync(
    fixture('pauses.cue'),
    [
      'PERFORMER "Cue Author"', 'TITLE "Cue Book"', 'FILE "pauses.wav" WAVE',
      '  TRACK 01 AUDIO', '    TITLE "Opening"', '    INDEX 01 00:00:00',
      '  TRACK 02 AUDIO', '    TITLE "The Middle"', '    INDEX 01 00:16:19',
      '  TRACK 03 AUDIO', '    TITLE "The End"', '    INDEX 01 00:33:56',
      '',
    ].join('\r\n'),
  )

  // One 50 s MP3 of three 15 s tones with 2.5 s of silence between them.
  await make(
    [
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=15', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
      '-filter_complex',
      '[1]asplit[a][b];[a]atrim=duration=2.5[s1];[b]atrim=duration=2.5[s2];[0]asplit=3[x][y][z];[x][s1][y][s2][z]concat=n=5:v=0:a=1',
      '-c:a', 'libmp3lame', '-b:a', '64k',
    ],
    'pauses.mp3',
  )

  // The same book as AAC in an MP4, named .mp3, as some downloads come: Add
  // chapters' split refused it ("ffmpeg exited with code 1").
  await ff.writeFile('pauses.mp3', readFileSync(fixture('pauses.mp3')))
  await make(['-i', 'pauses.mp3', '-c:a', 'aac', '-b:a', '64k', '-f', 'mp4'], 'pauses-aac.mp3')

  // An MP3 whose embedded cover starts like a JPEG and then isn't one: the
  // converter took it and failed at the very end ("The source image could not
  // be decoded").
  await make([...tone(450).map((x) => x.replace('duration=3', 'duration=5')), '-c:a', 'libmp3lame', '-b:a', '64k', '-id3v2_version', '0'], 'bad-cover.mp3')
  writeFileSync(fixture('bad-cover.mp3'), Buffer.concat([id3WithBrokenCover(), readFileSync(fixture('bad-cover.mp3'))]))

  // Files with their audio scrambled and their header intact: they open, and
  // encoding them fails (most of it can't be decoded). The M4A is 128 kbps so
  // the converter encodes it instead of copying it.
  await make([...tone(650).map((x) => x.replace('duration=3', 'duration=20')), '-c:a', 'aac', '-b:a', '128k', '-f', 'mp4'], 'scrambled.m4a')
  for (const [from, to] of [['book.m4b', 'scrambled.m4b'], ['scrambled.m4a', 'scrambled.m4a']]) {
    const b = readFileSync(fixture(from))
    for (let i = b.indexOf('mdat') + 4; i < b.indexOf('moov') - 4; i++) b[i] = (i * 7919) & 0xff
    writeFileSync(fixture(to), b)
  }
}

/** An ID3v2.3 tag with a title and a cover that starts like a JPEG and then isn't one. */
function id3WithBrokenCover(): Buffer {
  const frame = (id: string, data: Buffer) => {
    const head = Buffer.alloc(10)
    head.write(id, 0, 'latin1')
    head.writeUInt32BE(data.length, 4)
    return Buffer.concat([head, data])
  }
  const notAJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 37 + 11) & 0xff))])
  const picture = Buffer.concat([Buffer.from('\0image/jpeg\0\x03\0', 'latin1'), notAJpeg])
  const body = Buffer.concat([frame('TIT2', Buffer.from('\0Broken Cover', 'latin1')), frame('APIC', picture)])
  const n = body.length
  return Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]), body])
}
