# Features

What mp3tom4b does today, in present tense. No history, no roadmap — see [CHANGELOG.md](CHANGELOG.md) for what shipped when, and [BACKLOG.md](BACKLOG.md) for what's next.

---

## File handling

- Drag-and-drop input for MP3, M4A, WAV, FLAC, OGG, and Opus files.
- Click-to-browse fallback for users who prefer the OS file picker.
- Multi-file drop in a single action.
- Mixed drop — drop audio files and a cover image together; each is routed automatically.
- Folder drop — drop an entire audiobook folder; nested files are flattened, hidden files (`.DS_Store`, `__MACOSX`) are skipped, and the best image inside is picked as the cover.
- Best-cover selection rules — when multiple images are dropped, the file named `cover.*` / `folder.*` / `front.*` / `album.*` wins, with file size as a tiebreaker.
- Duplicate detection — files with matching size + duration are skipped silently, and the existing matching row briefly flashes to show what matched.
- Skipped files are always reported by name — non-audio files (`.txt`, `.pdf`, cue sheets) and rejected audio alike, including when a drop contains nothing usable. Hidden files stay silent.
- Unreadable files are caught on drop: when neither the tags nor the browser can decode a file, the row is flagged and converting is blocked until it's removed.
- Mixed-album warning when dropped files appear to come from different audiobooks based on their `album` tags.
- Per-file remove button.
- Drag-to-reorder file list (each file becomes one chapter in list order).
- Natural-order sort (Chapter 2 before Chapter 10) with A→Z / Z→A sort buttons; manual reorder switches to a "custom" order that no longer auto-sorts.

## Chapters

- Chapter title auto-generated from each filename (extension stripped, separators normalised, title-cased).
- Embedded `title` tag is used as the chapter title only when it is unique across the dropped files; otherwise the filename is used, so a set that shares one album/book title doesn't become a run of identical chapters.
- Each row shows the source filename beneath the title when they differ, with a pencil cue and hint making it clear titles are click-to-edit.
- Inline chapter title editing with keyboard navigation: Arrow/Enter moves to the next chapter, Shift+Enter or ArrowUp moves to the previous.
- Per-row "reset to original" button when a chapter title has been edited.

## Metadata

- Form fields: title (required), author (required), narrator, year, genre.
- Year validated as a 4-digit value between 1900 and 2099.
- Genre dropdown: Audiobook (default), Podcast, Lecture, Other.
- Auto-fill from the first dropped file's embedded tags — title, author, narrator, year, genre, and cover art populate any empty/untouched fields.
- "Verify metadata → Look up online" — searches iTunes Search first, then falls back to Open Library when iTunes has no match. Only title, author, and narrator are sent over the network; audio files never leave the browser.
- Per-source result badges ("from iTunes" / "from Open Library") on fields populated from a verified lookup.
- One-click cover apply from an iTunes match.

## Cover image

- JPG / PNG / WEBP upload via dedicated cover zone or via mixed drop.
- Live preview that mirrors the embedded result (letterboxed on a white background for non-square images), so what you see is what gets embedded.
- Corrupt or unreadable images are rejected the moment they are added, rather than failing at the end of a conversion.
- Auto-resize to 1200×1200 JPEG before embedding; non-square images are padded onto a white background.
- Source badge on the cover preview ("from drop" or "from audio file") so users see at a glance how the cover was set.
- Remove-cover button.

## Conversion

- Bitrate selector: 64 (default), 96, 128, 192, 256 kbps.
- Smart bitrate default — suggested bitrate is bumped automatically when source files are lossless or above 256 kbps and the genre is non-audiobook.
- Estimated output size preview that updates with bitrate changes ("~340 MB at 64 kbps").
- Multi-stage progress bar with human-readable labels (loading ffmpeg, probing, encoding chapter X of Y, muxing, finalizing).
- Estimated time remaining once conversion has settled into a stable phase.
- ffmpeg.wasm runs entirely in-browser; nothing is uploaded.
- Output is a single M4B file with chapter markers, embedded cover art, and full audiobook metadata, optimised for streaming/seek (`+faststart`).
- Output is tagged as an Audiobook (media type `stik=2`) with gapless playback, so players shelve it under audiobooks and keep the resume position.
- Warns before you close the tab or navigate away while a conversion or compression is still running.

## Split an M4B (M4B → MP3)

- Available at `/m4b-to-mp3`: drop a finished `.m4b` / `.m4a` and it is probed in-browser for its chapter list.
- Each chapter is re-encoded to an MP3 (64 / 96 / 128 kbps), named and numbered by chapter, and the set is bundled into a ZIP for download.
- A file without chapters is exported as a single MP3.
- Each MP3 is tagged with the chapter title, a track number, and the book's title/author (album/artist).
- Runs entirely in the browser via WebAssembly — the audiobook is never uploaded.

## Edit an M4B (chapters, metadata & cover)

- Available at `/edit-m4b-chapters`: drop a finished `.m4b` / `.m4a` and it is probed in-browser for its chapters, tags, duration, and cover.
- Edit the chapter list — rename, add, remove, or re-time chapters; the list re-orders itself by start time as you edit, and the first chapter is pinned to `0:00:00`.
- Add chapters to a file that has none, building the marker list from scratch.
- Live validation: chapter start times must increase and stay within the book length; Save is disabled with an inline reason until the list is valid.
- Edit the book metadata (title, author, narrator, year, genre) and choose to keep, replace, or remove the cover image.
- Metadata-only `-c copy` remux — the audio stream is copied through untouched, so there is no re-encode, no quality loss, and the save is near-instant even for a long book.
- Runs entirely in the browser via WebAssembly — the audiobook is never uploaded.

## Merge multiple M4Bs

- Available at `/merge-m4b`: drop two or more `.m4b` / `.m4a` files and each is probed in-browser for its chapters, length, audio settings, and cover.
- Drag-to-reorder the files (keyboard-accessible); they are joined top-to-bottom.
- Each file's chapters are shifted onto one continuous timeline, or optionally collapsed to a single chapter per file. A chapterless file becomes one chapter titled after it.
- Compatible files (same codec/sample rate/channels) are stream-copied together — no re-encode, no quality loss, near-instant; mismatched files are re-encoded to a common AAC target (with a notice and a bitrate choice).
- Set the combined book's title/author/narrator/year/genre (prefilled from the first file); pick which input file's cover to use, upload a new one, or remove it.
- Duplicate files (same name + size) are skipped with a notice; the download is named `{Author} - {Title} (merged).m4b` to avoid overwriting the sources.
- Runs entirely in the browser via WebAssembly — the files are never uploaded.

## Add chapters to a single file

- Available at `/add-chapters-to-mp3`: drop one long audio file (MP3, M4A, M4B, WAV, FLAC, OGG, Opus) and turn it into a chaptered M4B.
- Three ways to set chapter marks: split evenly into a number of chapters (or one every N minutes), auto-detect chapters from the silent pauses (`silencedetect`, opt-in — a full decode pass with progress + wake lock), or enter/adjust the times by hand.
- Editable chapter table (reused from the editor): first chapter pinned to 0:00:00, add/remove, auto-sort by time, live validation.
- Metadata form (prefilled from the file) and cover (keep the file's own, upload a new image, or remove).
- Bitrate 64 / 96 / 128 kbps; the audio stays one continuous stream with chapter markers added over it.
- Long files are split into chapter-sized pieces and re-encoded in parallel (bounded memory + faster); short files use a single pass.
- Runs entirely in the browser via WebAssembly — the file is never uploaded.

## Download

- Auto-generated filename in `{Author} - {Title}.m4b` format.
- Custom filename input — override the auto-generated name; the `.m4b` extension is added if missing, and a "reset" button restores the auto name.
- "Start over" button to clear all state and begin a new conversion.

## Compress an existing M4B

- Available on the `/compress-m4b` page via a mode toggle: "Shrink an existing M4B" (default) or "Build from separate files".
- Drop a single finished `.m4b` / `.m4a`; the file is probed in-browser for its duration, chapter count, cover presence, and current bitrate.
- Re-encodes only the audio stream to a lower AAC bitrate (64 / 96 / 128 kbps) while keeping the original chapters, cover art, and metadata untouched.
- Chaptered books are split at chapter boundaries and re-encoded in parallel across workers (~2–3× faster); chapterless files use a single serial pass.
- Estimated output size and expected space saving ("about 50% smaller") update with the chosen bitrate.
- Compression is disabled when the chosen bitrate is not lower than the source's current bitrate (it wouldn't shrink the file).
- Download filename derived from the file's embedded tags (`{Author} - {Title}.m4b`), falling back to the original name.
- Like the main converter, everything runs in the browser — the file is never uploaded.

## UI / UX

- Drop zone with privacy badge directly underneath.
- First-time visitor hint on the empty drop zone — short explainer of what M4B is, with a link to the FAQ.
- Dismissible drop notices ("Used X as cover", "Cover already set", "N files skipped") that auto-dismiss after 6 seconds.
- Dark mode that activates automatically based on operating-system preference.
- Responsive layout that works on tablet; desktop is the optimised target.
- Keyboard-accessible interactive elements; ARIA labels on icon-only buttons.
- aria-live progress announcements during conversion.
- Keeps the screen awake during conversion, compression, and splitting (while the tab is in the foreground) so a long job isn't interrupted by display sleep.
- Estimated time remaining on every long-running tool, projected from the recent rate of progress.
- The one-time ~31 MB engine download is named in the progress label on first use, rather than looking like a stall.
- Touch-sized (44px) drag, reset, and remove controls.

## Pages

- Homepage `/` is the converter itself — no marketing wall, no sign-up.
- `/about` — how the tool works and why it runs client-side.
- `/faq` — common questions about M4B, audiobooks, and the conversion process.
- `/privacy` — privacy policy.
- Five SEO sister landing pages with format-specific hero copy and FAQ: `/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`, `/opus-to-m4b`.
- `/compress-m4b` — landing page for shrinking or building a compact M4B, with the compressor and build tool behind a mode toggle.
- `/m4b-to-mp3` — landing page for splitting an M4B into per-chapter MP3s.
- `/edit-m4b-chapters` — landing page for editing chapters, metadata, and cover art in an existing M4B.
- `/merge-m4b` — landing page for merging several M4B files into one audiobook.
- `/add-chapters-to-mp3` — landing page for turning a single audio file into a chaptered M4B.

## SEO

- Open Graph and Twitter Card metadata on every page.
- JSON-LD `SoftwareApplication` schema on the homepage.
- JSON-LD `FAQPage` schema on the FAQ page and each sister landing page.
- Sitemap.xml covering all routes.
- robots.txt.

## Privacy

- All file processing happens in the browser via WebAssembly. No file is uploaded.
- The only network calls during normal use are: loading the page itself, loading ffmpeg.wasm on first conversion, and (only on explicit "Look up online" click) sending title/author/narrator to iTunes Search and/or Open Library.
- Cookieless analytics (Vercel Analytics).
- No third-party tracking scripts, no ads, no sign-up.
- Source code is open on GitHub for independent auditing.

## Quality

- TypeScript strict mode across the codebase.
- Vitest unit tests covering chapter generation, file validation, metadata extraction, image resize, bitrate logic, and ETA formatting.
- Lighthouse-targeted performance: instant first paint, ffmpeg.wasm loaded lazily on first conversion and cached thereafter.
