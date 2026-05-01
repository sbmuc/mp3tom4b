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
- Mixed-album warning when dropped files appear to come from different audiobooks based on their `album` tags.
- Per-file remove button.
- Drag-to-reorder file list (each file becomes one chapter in list order).
- Natural-order sort (Chapter 2 before Chapter 10) with A→Z / Z→A sort buttons; manual reorder switches to a "custom" order that no longer auto-sorts.

## Chapters

- Chapter title auto-generated from each filename (extension stripped, separators normalised, title-cased).
- Embedded `title` tag is used as the chapter title when present, falling back to the filename.
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
- Live preview thumbnail.
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

## Download

- Auto-generated filename in `{Author} - {Title}.m4b` format.
- Custom filename input — override the auto-generated name; the `.m4b` extension is added if missing, and a "reset" button restores the auto name.
- "Start over" button to clear all state and begin a new conversion.

## UI / UX

- Drop zone with privacy badge directly underneath.
- First-time visitor hint on the empty drop zone — short explainer of what M4B is, with a link to the FAQ.
- Dismissible drop notices ("Used X as cover", "Cover already set", "N files skipped") that auto-dismiss after 6 seconds.
- Dark mode that activates automatically based on operating-system preference.
- Responsive layout that works on tablet; desktop is the optimised target.
- Keyboard-accessible interactive elements; ARIA labels on icon-only buttons.
- aria-live progress announcements during conversion.

## Pages

- Homepage `/` is the converter itself — no marketing wall, no sign-up.
- `/about` — how the tool works and why it runs client-side.
- `/faq` — common questions about M4B, audiobooks, and the conversion process.
- `/privacy` — privacy policy.
- Five SEO sister landing pages with format-specific hero copy and FAQ: `/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`, `/opus-to-m4b`.

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
