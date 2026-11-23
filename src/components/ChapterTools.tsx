'use client'

import { useState } from 'react'
import { ClipboardCopy, ClipboardPaste, Replace, Undo2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import { applyTitles, formatChapterList, parseChapterList, type ListedChapter } from '@/lib/audio/chapterList'
import { numberedTitles, replaceInTitles, stripSharedText } from '@/lib/audio/chapterTitles'
import { stripTrackNumbers } from '@/lib/audio/format'

export interface ToolChapter {
  title: string
  /** Where the chapter starts (ms), when known. */
  startMs: number | null
}

interface Props<S> {
  /** Prefix for the tools' ids, unique on the page. */
  idPrefix: string
  chapters: ToolChapter[]
  /** New titles, one per chapter, in the same order. */
  onTitles: (titles: string[]) => void
  /**
   * Replace the chapters with a pasted list's; returns how many of them were
   * left out. Absent where the files make the chapters (the converter), so a
   * list's times can't be used there.
   */
  onTimedList?: (chapters: ListedChapter[]) => number
  /** For Undo: the chapters as they are, and putting them back. */
  snapshot: () => S
  restore: (snapshot: S) => void
  disabled?: boolean
}

type Panel = 'paste' | 'rename' | null

interface Status<S> {
  text: string
  /** What Undo puts back. */
  undo?: S
  /** The chapters right after the change: Undo goes once they change again. */
  after?: string
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
/** "the last chapter", "the last 3 chapters" */
const theLast = (n: number, word: string) => (n === 1 ? `the last ${word}` : `the last ${n} ${word}s`)
/** What happens to the titles and chapters that don't pair up, or ''. */
function unpaired(titleCount: number, chapterCount: number): string {
  if (titleCount > chapterCount) {
    const n = titleCount - chapterCount
    return `${theLast(n, 'title')} ${n === 1 ? "isn't" : "aren't"} used: there ${chapterCount === 1 ? 'is' : 'are'} ${plural(chapterCount, 'chapter')}`
  }
  if (titleCount < chapterCount) {
    const n = chapterCount - titleCount
    return `${theLast(n, 'chapter')} ${n === 1 ? 'keeps its title' : 'keep their titles'}`
  }
  return ''
}

function keyOf(chapters: ToolChapter[]): string {
  return JSON.stringify(chapters.map((c) => [c.startMs, c.title]))
}

const toolButton = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? 'border-accent-500 bg-accent-50 text-accent-800 dark:border-accent-400 dark:bg-accent-950/40 dark:text-accent-200'
      : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
  }`
const primaryButton =
  'inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton =
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
const fieldClass =
  'w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500'
const smallLabel = 'mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400'

/**
 * Tools for the whole chapter list at once: paste a list (with times, or only
 * titles), copy it out, find and replace in the titles, and the clean-ups
 * people otherwise do title by title. Each change can be undone until the
 * chapters change again. Everything stays in the page.
 */
export default function ChapterTools<S>({ idPrefix, chapters, onTitles, onTimedList, snapshot, restore, disabled }: Props<S>) {
  const [panel, setPanel] = useState<Panel>(null)
  const [pasted, setPasted] = useState('')
  const [find, setFind] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [status, setStatus] = useState<Status<S> | null>(null)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)

  const titles = chapters.map((c) => c.title)
  const currentKey = keyOf(chapters)

  // A change and its status land in the same render: remember the chapters it
  // left, so Undo is only offered while they're still like that.
  if (status && status.undo !== undefined && status.after === undefined) {
    setStatus({ ...status, after: currentKey })
  }
  const canUndo = status !== null && status.undo !== undefined && status.after === currentKey

  const togglePanel = (next: Exclude<Panel, null>) => setPanel((p) => (p === next ? null : next))

  const track = (action: string) => trackEvent('chapter_tool', { action, chapterCount: chapters.length })

  /** Make a change that can be undone, and say what it did. */
  const change = (action: string, apply: () => string) => {
    const before = snapshot()
    const text = apply()
    setStatus({ text, undo: before })
    setCopyFallback(null)
    track(action)
  }

  const undo = () => {
    if (!status || status.undo === undefined) return
    restore(status.undo)
    setStatus({ text: 'Undone.' })
    track('undo')
  }

  const copy = async () => {
    const text = formatChapterList(chapters)
    const withTimes = chapters.length > 0 && chapters.every((c) => c.startMs !== null)
    try {
      await navigator.clipboard.writeText(text)
      setCopyFallback(null)
      setStatus({ text: `Copied ${plural(chapters.length, 'chapter')}${withTimes ? ', with their start times' : ''}.` })
    } catch {
      setCopyFallback(text)
      setStatus({ text: "Your browser didn't let the page copy. Select the list below and copy it yourself." })
    }
    track('copy')
  }

  // ---- paste ----
  const parsed = parseChapterList(pasted)

  const applyPastedTitles = (pastedTitles: string[], action: string) =>
    change(action, () => {
      const { titles: next } = applyTitles(titles, pastedTitles)
      onTitles(next)
      setPasted('')
      setPanel(null)
      const rest = unpaired(pastedTitles.length, titles.length)
      const text = `Used ${plural(Math.min(pastedTitles.length, titles.length), 'pasted title')}.`
      return rest ? `${text} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.` : text
    })

  const applyPastedTimes = (list: ListedChapter[]) =>
    change('paste_times', () => {
      const leftOut = onTimedList ? onTimedList(list) : 0
      setPasted('')
      setPanel(null)
      const used = list.length - leftOut
      let text = `The chapters are now the ${plural(used, 'chapter')} from the list.`
      if (leftOut > 0) text += ` ${plural(leftOut, 'chapter')} ${leftOut === 1 ? 'was' : 'were'} left out: past the end, or in the same second as the one before.`
      return text
    })

  // ---- find & replace, and the one-go clean-ups ----
  const replaced = replaceInTitles(titles, find, replacement, matchCase)
  const changes = replaced.map((t, i) => [titles[i], t] as const).filter(([before, after]) => before !== after)
  const withoutNumbers = stripTrackNumbers(titles)
  const numbersChange = withoutNumbers.some((t, i) => t !== titles[i])
  const shared = stripSharedText(titles)
  const numbered = numberedTitles(titles.length)
  const numberingChanges = numbered.some((t, i) => t !== titles[i])

  const sharedLabel = shared
    ? [shared.prefix.trim(), shared.suffix.trim()]
        .filter(Boolean)
        .map((t) => `“${t}”`)
        .join(' and ')
    : ''

  const setAll = (action: string, next: string[], text: string) =>
    change(action, () => {
      onTitles(next)
      return text
    })

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tools for all chapters">
        <button
          type="button"
          onClick={() => togglePanel('paste')}
          disabled={disabled}
          aria-expanded={panel === 'paste'}
          aria-controls={panel === 'paste' ? `${idPrefix}-paste-panel` : undefined}
          className={toolButton(panel === 'paste')}
        >
          <ClipboardPaste size={13} aria-hidden="true" /> Paste a chapter list
        </button>
        <button type="button" onClick={() => void copy()} disabled={disabled || chapters.length === 0} className={toolButton(false)}>
          <ClipboardCopy size={13} aria-hidden="true" /> Copy the list
        </button>
        <button
          type="button"
          onClick={() => togglePanel('rename')}
          disabled={disabled || chapters.length === 0}
          aria-expanded={panel === 'rename'}
          aria-controls={panel === 'rename' ? `${idPrefix}-rename-panel` : undefined}
          className={toolButton(panel === 'rename')}
        >
          <Replace size={13} aria-hidden="true" /> Find &amp; replace in titles
        </button>
      </div>

      {panel === 'paste' && (
        <div id={`${idPrefix}-paste-panel`} className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <label htmlFor={`${idPrefix}-paste`} className={smallLabel}>
            Paste a chapter list
          </label>
          <textarea
            id={`${idPrefix}-paste`}
            rows={6}
            value={pasted}
            disabled={disabled}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'0:00:00 Opening Credits\n0:00:32 Chapter 1\n0:21:05 Chapter 2\n…or only the titles, one per line'}
            aria-describedby={`${idPrefix}-paste-help`}
            className={`${fieldClass} font-mono text-xs`}
            spellCheck={false}
          />
          <p id={`${idPrefix}-paste-help`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {onTimedList
              ? 'A start time and a title per line (like a chapters.txt or the chapters in a YouTube description), or only titles, one per line, for the chapters in order.'
              : 'One title per line, for the chapters in order. Each file is one chapter here, so a list with times only gives its titles.'}
          </p>

          {parsed.kind === 'timed' && (
            <div className="mt-3">
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {onTimedList
                  ? `${plural(parsed.chapters.length, 'chapter')} with a start time`
                  : `${plural(parsed.chapters.length, 'title')}`}
                {parsed.skipped > 0 && ` (${plural(parsed.skipped, 'line')} without a time skipped)`}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {onTimedList && (
                  <button type="button" disabled={disabled} onClick={() => applyPastedTimes(parsed.chapters)} className={primaryButton}>
                    Replace the chapters
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => applyPastedTitles(parsed.chapters.map((c) => c.title), onTimedList ? 'paste_titles_only' : 'paste_titles')}
                  className={onTimedList ? secondaryButton : primaryButton}
                >
                  {onTimedList ? 'Use only the titles' : 'Use the titles'}
                </button>
              </div>
            </div>
          )}

          {parsed.kind === 'titles' && (
            <div className="mt-3">
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                {`${plural(parsed.titles.length, 'title')} for ${plural(titles.length, 'chapter')}`}
                {unpaired(parsed.titles.length, titles.length) && `: ${unpaired(parsed.titles.length, titles.length)}`}.
              </p>
              <div className="mt-2">
                <button type="button" disabled={disabled} onClick={() => applyPastedTitles(parsed.titles, 'paste_titles')} className={primaryButton}>
                  Use the titles
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {panel === 'rename' && (
        <div id={`${idPrefix}-rename-panel`} className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idPrefix}-find`} className={smallLabel}>
                Find
              </label>
              <input id={`${idPrefix}-find`} type="text" value={find} disabled={disabled} onChange={(e) => setFind(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-replace`} className={smallLabel}>
                Replace with <span className="font-normal">(empty to remove)</span>
              </label>
              <input
                id={`${idPrefix}-replace`}
                type="text"
                value={replacement}
                disabled={disabled}
                onChange={(e) => setReplacement(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={matchCase} disabled={disabled} onChange={(e) => setMatchCase(e.target.checked)} className="accent-accent-600" />
              Match case
            </label>
            <button
              type="button"
              disabled={disabled || changes.length === 0}
              onClick={() => {
                setAll('replace', replaced, `Replaced in ${plural(changes.length, 'title')}.`)
                setFind('')
                setReplacement('')
              }}
              className={primaryButton}
            >
              {find === '' ? 'Replace' : changes.length === 0 ? 'No title has this' : `Replace in ${plural(changes.length, 'title')}`}
            </button>
          </div>
          {changes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400" aria-label="Examples of the change">
              {changes.slice(0, 2).map(([before, after], i) => (
                <li key={i} className="truncate">
                  “{before}” → “{after}”
                </li>
              ))}
              {changes.length > 2 && <li>…and {plural(changes.length - 2, 'more')}</li>}
            </ul>
          )}

          {(numbersChange || shared || numberingChanges) && (
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Or for every title at once:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {numbersChange && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setAll('track_numbers', withoutNumbers, 'Removed the track numbers.')}
                    className={secondaryButton}
                  >
                    Remove the track numbers
                  </button>
                )}
                {shared && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setAll('shared_text', shared.titles, `Removed ${sharedLabel} from every title.`)}
                    className={secondaryButton}
                  >
                    Remove {sharedLabel}
                  </button>
                )}
                {numberingChanges && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setAll('number', numbered, `Named the chapters Chapter 1 to ${titles.length}.`)}
                    className={secondaryButton}
                  >
                    Name them Chapter 1, 2, 3…
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {copyFallback !== null && (
        <textarea
          readOnly
          rows={Math.min(8, Math.max(3, chapters.length))}
          value={copyFallback}
          aria-label="The chapter list, to copy"
          onFocus={(e) => e.currentTarget.select()}
          className={`${fieldClass} mt-2 font-mono text-xs`}
        />
      )}

      <div className={`flex flex-wrap items-center gap-2 ${status ? 'mt-2' : ''}`}>
        <p role="status" aria-live="polite" className="text-xs text-zinc-700 dark:text-zinc-300">
          {status?.text}
        </p>
        {canUndo && (
          <button
            type="button"
            onClick={undo}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-accent-700 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 dark:text-accent-400"
          >
            <Undo2 size={12} aria-hidden="true" /> Undo
          </button>
        )}
      </div>
    </div>
  )
}
