/**
 * Test files for the browser smoke tests, made with the site's own
 * ffmpeg-core in Node (tests/integration/nodeFFmpeg.ts) so nothing binary is
 * committed: sine tones with tags, a cover, and two chaptered M4Bs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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

  // One 16-minute file, longer than the converter's "one long file" threshold.
  // 8 kHz mono at 8 kbps keeps it under 1 MB and quick to make.
  await make(
    ['-f', 'lavfi', '-i', 'sine=frequency=300:duration=960:sample_rate=8000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '8k'],
    'long.mp3',
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
}
