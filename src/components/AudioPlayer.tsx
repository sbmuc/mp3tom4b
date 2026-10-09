'use client'

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, BookAudio, Loader2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react'
import { formatDuration } from '@/lib/audio/format'
import {
  chapterIndexAt,
  playbackType,
  previousChapterStart,
  readPlaybackInfo,
  type Chapter,
  type PlaybackInfo,
} from '@/lib/audio/playback'

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
const BACK_SEC = 15
const FORWARD_SEC = 30

const chapterLabel = (c: Chapter, i: number) => c.title || `Chapter ${i + 1}`

function mediaErrorMessage(error: MediaError | null): string {
  if (error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
    return "This browser can't play this file's audio format. Try another browser, or re-encode it with the converter."
  if (error?.code === MediaError.MEDIA_ERR_DECODE) return "The audio couldn't be decoded. The file may be damaged."
  return 'Playback stopped because the file could not be read.'
}

const hasMediaSession = () => typeof navigator !== 'undefined' && 'mediaSession' in navigator

interface Props {
  /** The audio to play. To play another file, remount with a new `key`. */
  file: Blob
  /** Fallback title when the file has no title tag; also tells MP3 from MP4. */
  fileName: string
  /** Shown under "No chapter markers" (e.g. a link to a tool that adds them). */
  noChaptersHint?: ReactNode
}

/**
 * Plays an audiobook with the browser's own audio element: chapter list and
 * chapter skipping, ±seconds, speed, and lock-screen / media-key controls via
 * the Media Session API. Reads tags and chapters locally; nothing is uploaded.
 */
export default function AudioPlayer({ file, fileName, noChaptersHint }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const speedId = useId()
  const [src, setSrc] = useState<string | null>(null)
  const [info, setInfo] = useState<PlaybackInfo | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file.slice(0, file.size, playbackType(file, fileName)))
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file, fileName])

  useEffect(() => {
    let cancelled = false
    setInfo(null)
    readPlaybackInfo(file).then((i) => {
      if (!cancelled) setInfo(i)
    })
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    if (!info?.cover) {
      setCoverUrl(null)
      return
    }
    const url = URL.createObjectURL(info.cover)
    setCoverUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [info])

  // Stop the sound when the player goes away (e.g. "Start over").
  useEffect(() => {
    const audio = audioRef.current
    return () => audio?.pause()
  }, [])

  const chapters = useMemo(() => {
    const list = info?.chapters ?? []
    // Markers past the end of the audio can't be reached; keep the first regardless.
    return duration > 0 ? list.filter((c, i) => i === 0 || c.startSec < duration) : list
  }, [info, duration])
  const chaptersRef = useRef(chapters)
  useEffect(() => {
    chaptersRef.current = chapters
  }, [chapters])

  const current = chapterIndexAt(chapters, time)
  const chapter = current >= 0 ? chapters[current] : null
  const chapterEnd = current + 1 < chapters.length ? chapters[current + 1].startSec : duration
  const bookTitle = info?.title || fileName.replace(/\.[^.]+$/, '')

  // ---- controls (stable, so the Media Session handlers can hold them) ----
  const seek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    const end = Number.isFinite(audio.duration) ? audio.duration : t
    audio.currentTime = Math.max(0, Math.min(t, end))
    setTime(audio.currentTime)
  }, [])
  const skip = useCallback((delta: number) => {
    const audio = audioRef.current
    if (audio) seek(audio.currentTime + delta)
  }, [seek])
  const play = useCallback(() => {
    // Rejections (autoplay policy, unsupported source) surface via the error event or simply leave it paused.
    audioRef.current?.play().catch(() => {})
  }, [])
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) play()
    else audio.pause()
  }, [play])
  const prevChapter = useCallback(() => {
    const audio = audioRef.current
    if (audio) seek(previousChapterStart(chaptersRef.current, audio.currentTime))
  }, [seek])
  const nextChapter = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const list = chaptersRef.current
    const i = chapterIndexAt(list, audio.currentTime)
    if (i + 1 < list.length) seek(list[i + 1].startSec)
  }, [seek])
  const playChapter = useCallback(
    (i: number) => {
      const c = chaptersRef.current[i]
      if (!c) return
      seek(c.startSec)
      play()
    },
    [seek, play],
  )
  const changeRate = (value: number) => {
    if (audioRef.current) audioRef.current.playbackRate = value
  }

  // ---- lock screen, headset buttons, media keys ----
  useEffect(() => {
    if (!hasMediaSession()) return
    const session = navigator.mediaSession
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', play],
      ['pause', () => audioRef.current?.pause()],
      ['seekbackward', (d) => skip(-(d.seekOffset ?? BACK_SEC))],
      ['seekforward', (d) => skip(d.seekOffset ?? FORWARD_SEC)],
      ['seekto', (d) => d.seekTime != null && seek(d.seekTime)],
      ['previoustrack', prevChapter],
      ['nexttrack', nextChapter],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // This browser doesn't support that action.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // Not supported, so nothing to clear.
        }
      }
      session.metadata = null
      session.playbackState = 'none'
    }
  }, [play, skip, seek, prevChapter, nextChapter])

  const sessionTitle = chapter ? chapterLabel(chapter, current) : bookTitle
  useEffect(() => {
    if (!hasMediaSession() || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: sessionTitle,
      artist: info?.author ?? '',
      album: bookTitle,
      artwork: coverUrl ? [{ src: coverUrl, type: info?.cover?.type }] : [],
    })
  }, [sessionTitle, bookTitle, info, coverUrl])

  const syncPosition = () => {
    const audio = audioRef.current
    if (!audio || !hasMediaSession() || !Number.isFinite(audio.duration)) return
    try {
      navigator.mediaSession.setPositionState?.({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      })
    } catch {
      // Older Safari throws on some states; the lock screen just shows less.
    }
  }
  const setSessionState = (state: MediaSessionPlaybackState) => {
    if (hasMediaSession()) navigator.mediaSession.playbackState = state
  }

  const iconButton =
    'inline-flex h-11 min-w-[44px] items-center justify-center gap-0.5 rounded-full px-2 text-zinc-700 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-800'
  // iOS Safari loads nothing before the first play, so Play can't wait for metadata.
  const canPlay = !!src && !error
  const ready = duration > 0 && !error

  return (
    <section
      aria-label={`Audiobook player: ${bookTitle}`}
      className="rounded-lg border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-900"
    >
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          setDuration(Number.isFinite(d) ? d : 0)
          setError(null)
          syncPosition()
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration
          setDuration(Number.isFinite(d) ? d : 0)
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true)
          setSessionState('playing')
          syncPosition()
        }}
        onPause={() => {
          setPlaying(false)
          setSessionState('paused')
          syncPosition()
        }}
        onEnded={() => setPlaying(false)}
        onSeeked={syncPosition}
        onRateChange={(e) => {
          setRate(e.currentTarget.playbackRate)
          syncPosition()
        }}
        onError={(e) => setError(mediaErrorMessage(e.currentTarget.error))}
      />

      <div className="flex items-start gap-3">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob: URL, nothing for next/image to optimise
          <img src={coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-md bg-zinc-100 object-cover dark:bg-zinc-800" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <BookAudio size={24} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{bookTitle}</p>
          {(info?.author || info?.narrator) && (
            <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {info.author}
              {info.author && info.narrator && ' · '}
              {info.narrator && `narrated by ${info.narrator}`}
            </p>
          )}
          <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {info
              ? chapters.length === 1
                ? '1 chapter'
                : `${chapters.length} chapters`
              : 'Reading chapters…'}
            {duration > 0 && ` · ${formatDuration(duration)}`}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {chapter ? (
            <>
              Chapter {current + 1} of {chapters.length}
              <span className="sr-only">: {chapterLabel(chapter, current)}</span>
            </>
          ) : (
            ' '
          )}
        </p>
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {chapter ? chapterLabel(chapter, current) : bookTitle}
        </p>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(time, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!ready}
          aria-label="Position in audiobook"
          aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
          className="mt-2 w-full cursor-pointer accent-accent-600 disabled:cursor-default dark:accent-accent-400"
        />
        <div className="flex justify-between font-mono text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatDuration(time)}</span>
          {chapter && chapterEnd > time && <span>−{formatDuration(chapterEnd - time)} in chapter</span>}
          {/* Unknown until the audio loads; iOS only loads it on the first play. */}
          <span>{duration > 0 ? formatDuration(duration) : '–:––'}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={prevChapter} disabled={!ready} aria-label="Previous chapter" className={iconButton}>
            <SkipBack size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => skip(-BACK_SEC)} disabled={!ready} aria-label={`Back ${BACK_SEC} seconds`} className={iconButton}>
            <RotateCcw size={18} aria-hidden="true" />
            <span className="font-mono text-xs" aria-hidden="true">{BACK_SEC}</span>
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canPlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="mx-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-600 text-white hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:opacity-40 dark:focus-visible:ring-offset-zinc-900"
          >
            {!src ? (
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            ) : playing ? (
              <Pause size={20} aria-hidden="true" />
            ) : (
              <Play size={20} className="translate-x-px" aria-hidden="true" />
            )}
          </button>
          <button type="button" onClick={() => skip(FORWARD_SEC)} disabled={!ready} aria-label={`Forward ${FORWARD_SEC} seconds`} className={iconButton}>
            <span className="font-mono text-xs" aria-hidden="true">{FORWARD_SEC}</span>
            <RotateCw size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={nextChapter}
            disabled={!ready || current + 1 >= chapters.length}
            aria-label="Next chapter"
            className={iconButton}
          >
            <SkipForward size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={speedId} className="text-xs text-zinc-500 dark:text-zinc-400">
            Speed
          </label>
          <select
            id={speedId}
            value={rate}
            onChange={(e) => changeRate(Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        {!info ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Reading chapters…
          </p>
        ) : chapters.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No chapter markers in this file. {noChaptersHint}
          </p>
        ) : (
          <ChapterList chapters={chapters} current={current} onSelect={playChapter} />
        )}
      </div>
    </section>
  )
}

/** Memoised so a 300-chapter list doesn't re-render on every time update. */
const ChapterList = memo(function ChapterList({
  chapters,
  current,
  onSelect,
}: {
  chapters: Chapter[]
  current: number
  onSelect: (i: number) => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  const labelId = useId()

  // Keep the playing chapter in view inside the list, without scrolling the page.
  useEffect(() => {
    const list = listRef.current
    const item = current >= 0 ? (list?.children[current] as HTMLElement | undefined) : undefined
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop || item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop - list.clientHeight / 3
    }
  }, [current])

  return (
    <>
      <p id={labelId} className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Chapters
      </p>
      <ol ref={listRef} aria-labelledby={labelId} className="relative max-h-72 overflow-y-auto">
        {chapters.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === current ? 'true' : undefined}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 ${
                i === current
                  ? 'bg-accent-50 font-medium text-accent-800 dark:bg-accent-950/40 dark:text-accent-300'
                  : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span className="w-8 shrink-0 font-mono text-xs text-zinc-400 dark:text-zinc-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{chapterLabel(c, i)}</span>
              <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">{formatDuration(c.startSec)}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  )
})
