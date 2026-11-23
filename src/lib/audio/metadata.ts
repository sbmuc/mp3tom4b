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

type NativeTags = Record<string, Array<{ id: string; value: unknown }>>

/** The first non-empty text among native tags with one of these ids (any case, any tag format). */
function nativeText(native: NativeTags | undefined, ids: string[]): string | undefined {
  if (!native) return undefined
  const wanted = new Set(ids.map((id) => id.toLowerCase()))
  for (const tags of Object.values(native)) {
    for (const tag of tags) {
      if (!wanted.has(tag.id.toLowerCase())) continue
      const v = tag.value
      const text = typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : undefined
      if (text?.trim()) return text.trim()
    }
  }
  return undefined
}

/**
 * Extract embedded ID3/MP4/Vorbis metadata from an audio file.
 * Runs entirely in-browser via music-metadata; nothing is uploaded.
 * Returns an empty object on parse failure (e.g. no tags present).
 */
export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  try {
    const { common, format, native } = await parseBlob(file)

    const title = common.album?.trim() || undefined
    const author = (common.artist || common.albumartist)?.trim() || undefined
    const narrator = common.composer?.[0]?.trim() || undefined
    const year = common.year ? String(common.year) : undefined
    const genre = mapGenre(common.genre?.[0])
    const chapterTitle = common.title?.trim() || undefined
    // The long description before the short one: an M4B's ldes, then its
    // desc (both ours), or an MP3's TDES.
    const description = (common.longDescription || common.description?.[0])?.trim() || undefined
    // Where Audiobookshelf reads a series: an M4B's tvsh (ours), the movement
    // tags (MP4 ©mvn, ID3 MVNM), or a SERIES text tag.
    const series =
      common.tvShow?.trim() || common.movement?.trim() || nativeText(native as NativeTags, ['TXXX:SERIES', 'SERIES']) || undefined
    const movementNo = common.movementIndex?.no
    const seriesPart =
      common.tvEpisodeId?.trim() ||
      (typeof movementNo === 'number' && movementNo > 0 ? String(movementNo) : undefined) ||
      nativeText(native as NativeTags, ['TXXX:SERIES-PART', 'SERIES-PART']) ||
      undefined
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
    const sourceSampleRate =
      typeof format.sampleRate === 'number' && format.sampleRate > 0 ? format.sampleRate : undefined
    const sourceChannels =
      typeof format.numberOfChannels === 'number' && format.numberOfChannels > 0 ? format.numberOfChannels : undefined
    const sourceCodec = format.codec || undefined

    return {
      title,
      author,
      narrator,
      year,
      genre,
      description,
      series,
      seriesPart,
      chapterTitle,
      coverFile,
      durationMs,
      sourceBitrateKbps,
      sourceLossless,
      sourceSampleRate,
      sourceChannels,
      sourceCodec,
    }
  } catch {
    return {}
  }
}
