import { parseBlob } from 'music-metadata'
import type { ExtractedMetadata, Genre } from '@/types'

const KNOWN_GENRES: readonly Genre[] = ['Audiobook', 'Podcast', 'Lecture', 'Other']

function mapGenre(value: string | undefined): Genre | undefined {
  if (!value) return undefined
  const lower = value.trim().toLowerCase()
  return KNOWN_GENRES.find((g) => g.toLowerCase() === lower)
}

function pictureToFile(picture: { format: string; data: Uint8Array } | undefined): File | undefined {
  if (!picture) return undefined
  const mime = picture.format || 'image/jpeg'
  const ext = mime.includes('png') ? 'png' : 'jpg'
  // Copy into a fresh ArrayBuffer so the Blob owns its data.
  const buf = new Uint8Array(picture.data)
  return new File([buf], `embedded-cover.${ext}`, { type: mime })
}

/**
 * Extract embedded ID3/MP4/Vorbis metadata from an audio file.
 * Runs entirely in-browser via music-metadata; nothing is uploaded.
 * Returns an empty object on parse failure (e.g. no tags present).
 */
export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  try {
    const { common, format } = await parseBlob(file)

    const title = common.album?.trim() || undefined
    const author = (common.artist || common.albumartist)?.trim() || undefined
    const narrator = common.composer?.[0]?.trim() || undefined
    const year = common.year ? String(common.year) : undefined
    const genre = mapGenre(common.genre?.[0])
    const chapterTitle = common.title?.trim() || undefined
    const coverFile = pictureToFile(common.picture?.[0])
    const durationMs =
      typeof format.duration === 'number' && Number.isFinite(format.duration)
        ? Math.round(format.duration * 1000)
        : undefined
    const sourceBitrateKbps =
      typeof format.bitrate === 'number' && Number.isFinite(format.bitrate) && format.bitrate > 0
        ? Math.round(format.bitrate / 1000)
        : undefined
    const sourceLossless = typeof format.lossless === 'boolean' ? format.lossless : undefined

    return {
      title,
      author,
      narrator,
      year,
      genre,
      chapterTitle,
      coverFile,
      durationMs,
      sourceBitrateKbps,
      sourceLossless,
    }
  } catch {
    return {}
  }
}
