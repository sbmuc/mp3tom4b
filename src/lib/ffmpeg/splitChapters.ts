'use client'

import { fetchFile } from '@ffmpeg/util'
import { getFFmpeg } from './client'

export interface Chapter {
  title: string
  startMs: number
  endMs: number
}

function unescapeMetadataValue(value: string): string {
  // Inverse of the escaping in chapters.ts (\, =, ;, #, newline are backslash-escaped).
  return value.replace(/\\([\\=;#\n])/g, '$1')
}

/**
 * Parse the `[CHAPTER]` blocks from an ffmetadata dump
 * (`ffmpeg -i in -f ffmetadata out.txt`) into chapter marks in milliseconds.
 * Pure + unit-testable — inverse of buildFFMetadata in chapters.ts.
 */
export function parseChapters(ffmetadata: string): Chapter[] {
  const chapters: Chapter[] = []
  // Split on the [CHAPTER] header; drop everything before the first one.
  const blocks = ffmetadata.split(/^\[CHAPTER\]\s*$/im).slice(1)
  for (const block of blocks) {
    const startM = block.match(/^\s*START\s*=\s*(\d+)/im)
    const endM = block.match(/^\s*END\s*=\s*(\d+)/im)
    if (!startM || !endM) continue

    // TIMEBASE=num/den seconds per tick; default 1/1000 (milliseconds).
    let num = 1
    let den = 1000
    const tbM = block.match(/^\s*TIMEBASE\s*=\s*(\d+)\s*\/\s*(\d+)/im)
    if (tbM) {
      num = Number(tbM[1])
      den = Number(tbM[2])
    }
    const toMs = (ticks: number) => (den > 0 ? Math.round((ticks * num * 1000) / den) : ticks)

    const titleM = block.match(/^\s*title\s*=\s*(.*)$/im)
    chapters.push({
      title: titleM ? unescapeMetadataValue(titleM[1].trim()) : '',
      startMs: toMs(Number(startM[1])),
      endMs: toMs(Number(endM[1])),
    })
  }
  return chapters
}

/**
 * Probe an M4B/M4A for its chapter list. Dumps ffmetadata to a virtual file and
 * parses it. Runs entirely in-browser on the shared ffmpeg singleton.
 */
export async function probeChapters(file: File): Promise<Chapter[]> {
  const ffmpeg = await getFFmpeg()
  const inName = `chapsrc_${Date.now()}`
  const outName = `chapmeta_${Date.now()}.txt`
  try {
    await ffmpeg.writeFile(inName, await fetchFile(file))
    try {
      await ffmpeg.exec(['-hide_banner', '-i', inName, '-f', 'ffmetadata', outName])
    } catch {
      // ignore — we read whatever metadata file was produced
    }
    let text = ''
    try {
      const data = await ffmpeg.readFile(outName)
      text = data instanceof Uint8Array ? new TextDecoder().decode(data) : String(data)
    } catch {
      // no metadata file produced
    }
    return parseChapters(text)
  } finally {
    try {
      await ffmpeg.deleteFile(inName)
    } catch {
      /* ignore */
    }
    try {
      await ffmpeg.deleteFile(outName)
    } catch {
      /* ignore */
    }
  }
}
