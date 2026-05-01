# Changelog

> New entries go on top. Each entry should be user-facing language describing the change. Implementation details belong in commit messages, not here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to semantic-ish versioning.

---

## [1.3.0] — 2026-04-27

### Added
- Drop zone now accepts audio files **and** cover images in a single drop. The right files go to the right place automatically.
- Folder drop support — drop an audiobook folder and the tool flattens it, picks audio files, and uses the best image inside as the cover.
- Best-cover selection rules — when multiple images are dropped, the file named `cover.*` / `folder.*` / `front.*` wins (then largest file size as tiebreak).
- Dismissible drop notices ("Used X as cover", "Cover already set", "N files skipped") that auto-dismiss after 6 seconds.

### Changed
- Drop zone hint updated to "Drop audio files + cover image, or click to browse" with format list including JPG and PNG.
- Cover preview badge now distinguishes "from drop" (image dropped alongside audio) from "from audio file" (extracted from embedded tags).

---

## [1.2.1] — 2026-04-27

### Fixed
- Cover thumbnails in the "Verify metadata → Look up online" panel no longer render as broken-image icons. The fix preserves the strict cross-origin isolation needed for the conversion pipeline.

---

## [1.2.0] — 2026-04-27

### Added
- Estimated time remaining displayed during conversion, based on observed encoding speed.
- Custom output filename input on the download card — override the auto-generated `{Author} - {Title}.m4b` pattern with a click-to-reset.
- Inline chapter title editing improvements: keyboard navigation (Arrow/Enter to next, Shift+Enter/ArrowUp to previous), per-row "reset to original" button, sharper focus state.
- First-time experience hint on the empty drop zone — short explainer of what M4B is and what to expect, with a link to the FAQ.
- Higher bitrate options (192 kbps and 256 kbps) for users converting music or high-quality audio content.
- Smart default bitrate based on source files — bumps suggested bitrate when inputs are lossless or above 256 kbps and the genre isn't audiobook.
- Estimated output file size preview that updates with bitrate changes ("~340 MB at 64 kbps").
- Embedded metadata extraction — title, author, narrator, year, genre, and embedded cover art are auto-filled from the first dropped file's tags when fields are still empty.
- Per-file embedded chapter title is used as the initial chapter name when present, falling back to filename otherwise.

### Changed
- Dark mode now activates correctly based on operating-system preference (previously the dark theme never engaged).
- Footer text contrast raised in dark mode for readability.

---

## [1.1.0] — 2026-04-27

### Added
- Five sister landing pages with format-specific copy and FAQ schema: `/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`, `/opus-to-m4b`.
- "Verify metadata → Look up online" — search audiobook metadata via iTunes Search, with automatic fallback to Open Library when no iTunes match is found. Only the title, author, and narrator are sent over the network; never audio files. Verified fields are tagged with a "from iTunes" / "from Open Library" badge.
- Cover image fetched from an iTunes match can be applied to the audiobook with one click.
- Mixed-album warning that flags when dropped files appear to belong to different audiobooks based on their `album` tags.
- Duplicate-file detection on drop — files with identical size + duration are skipped silently and the existing matching row briefly flashes to show what matched.
- Natural-order file sorting (Chapter 2 before Chapter 10) with A→Z / Z→A sort buttons; manual drag-to-reorder switches to "custom" order and stops auto-sorting.
- "How it works" and "Why MP3 to M4B" explainer sections on the homepage for SEO and reassurance.
- Initial Vitest test suite (82 tests across nine files) covering chapter generation, file validation, metadata extraction, image resize, bitrate logic, and ETA formatting.

### Changed
- Sitemap updated to include all five new sister landing pages.

---

## [1.0.0] — 2026-04-26

### Added
- Initial public release of mp3tom4b.com.
- Drag-and-drop input for MP3, M4A, WAV, FLAC, OGG, and Opus files. Click-to-browse fallback.
- File list with drag-to-reorder (each file becomes one chapter, in list order).
- Auto-generated chapter titles from filenames, editable inline.
- Per-file remove button.
- Audiobook metadata form: title, author, narrator, year, genre.
- Cover image upload with auto-resize to 1200×1200 JPEG.
- Bitrate selector (64 / 96 / 128 kbps).
- Convert button with multi-stage progress bar (loading ffmpeg, decoding, encoding, muxing, finalizing).
- M4B download with auto-generated `{Author} - {Title}.m4b` filename.
- Reset / "Start over" button after download.
- About, FAQ, and Privacy pages.
- Open Graph + Twitter Card metadata, JSON-LD `SoftwareApplication` and `FAQPage` schema, sitemap, robots.txt.
- Privacy-respecting Vercel Analytics (cookieless).
- Header with navigation, footer with privacy badge and KvK details.
- Dark / light theming (initial implementation; a later release fixed activation).
- Open-source repository on GitHub under MIT license.
