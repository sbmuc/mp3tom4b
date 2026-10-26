'use client'

import type { FFFSType, FFmpeg, FileData } from '@ffmpeg/ffmpeg'

/**
 * Getting files in and out of an ffmpeg instance without holding extra copies.
 *
 * Inputs and intermediates are mounted, never written in: WORKERFS reads a File
 * or Blob in small pieces as ffmpeg asks for them, so it never has to fit in
 * the page's memory as a whole, and the browser can keep a large Blob on disk.
 * Outputs are read out once and deleted from the instance straight away.
 */

const WORKERFS = 'WORKERFS' as FFFSType

/** Mount blobs read-only as `dir/<name>`, replacing whatever was mounted there. */
export async function mountBlobs(ffmpeg: FFmpeg, dir: string, blobs: { name: string; data: Blob }[]): Promise<void> {
  await unmount(ffmpeg, dir)
  try {
    await ffmpeg.createDir(dir)
  } catch {
    // left over from an earlier run
  }
  await ffmpeg.mount(WORKERFS, { blobs }, dir)
}

export async function unmount(ffmpeg: FFmpeg, dir: string): Promise<void> {
  try {
    await ffmpeg.unmount(dir)
  } catch {
    // not mounted
  }
}

/**
 * readFile's result as bytes a Blob accepts. It already owns a whole
 * ArrayBuffer (the worker transfers it), so no copy is made: for a finished
 * audiobook a copy would be another few hundred MB at the worst moment.
 */
export function ownedBytes(data: FileData): Uint8Array<ArrayBuffer> {
  if (typeof data === 'string') return new TextEncoder().encode(data)
  if (data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data as Uint8Array<ArrayBuffer>
  }
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy
}

/** Read a file out of the instance and delete it there. */
export async function takeBytes(ffmpeg: FFmpeg, path: string): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = ownedBytes(await ffmpeg.readFile(path))
  try {
    await ffmpeg.deleteFile(path)
  } catch {
    // already gone
  }
  return bytes
}

/** takeBytes as a Blob, which the browser can keep out of the page's memory. */
export async function takeBlob(ffmpeg: FFmpeg, path: string, type = 'audio/mp4'): Promise<Blob> {
  return new Blob([await takeBytes(ffmpeg, path)], { type })
}
