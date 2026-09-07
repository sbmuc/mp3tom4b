# Changelog

> New entries go on top. Each entry should be user-facing language describing the change. Implementation details belong in commit messages, not here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to semantic-ish versioning.

---

## [1.9.1] — 2026-09-07

### Added
- **Estimated time remaining** in every tool (compress, split, edit, merge, add chapters), not just the main converter — so you can tell whether a long job is worth waiting for.
- The one-time engine download is now stated plainly: the first run shows "Downloading converter (one-time, ~31 MB)…" instead of an unexplained pause, and just "Loading converter…" once it's cached.

### Fixed
- Chapter titles taken from filenames are no longer forced into English Title Case, which mangled Dutch and German names ("van der Meer"), deliberate capitals, and apostrophes, and left a triple space where a " - " separator was removed.
- "Split evenly" in the chapter tool no longer produces duplicate times on a short file (which its own validation then rejected); it caps the split at what fits and says so.
- Files that aren't audio are no longer discarded silently — they're listed by name, including when a drop contains nothing else (which previously did nothing at all). Rejected audio files are named too.
- A file that can't be read is now caught when you add it: the row is flagged and converting is blocked until you remove it, instead of failing part-way through. Files whose tags lack a duration now show one anyway.
- Invalid chapter rows are marked in place, with the reason on the row, instead of only a message next to the Save button.
- The download card no longer vanishes without explanation when you change a setting after converting — it now says why and prompts you to convert again.
- The cover preview is letterboxed on white in dark mode too, matching how the cover is actually embedded.
- Drag, reset, and remove buttons are now full-size touch targets.

---

## [1.9.0] — 2026-09-06

### Added
- **Add chapters to a single file** — a new tool at `/add-chapters-to-mp3` that turns one long audio file (MP3, M4A, M4B, WAV, FLAC, OGG, or Opus) into a properly chaptered M4B. Set the chapter marks three ways: split evenly into N chapters (or one every N minutes), auto-detect chapters from the silent pauses in the recording, or type the times by hand — then edit any of them. Metadata and cover (keep the file's own, upload a new one, or remove it) are set like the other tools.
- This fills the gap where one big MP3 could only become a single-chapter audiobook. The audio stays one continuous file; only chapter markers are added.
- The homepage and the other M4B tool pages link to it, and it's in the sitemap.

### Fixed
- Long books no longer run out of memory while converting: the file is split into chapter-sized pieces, re-encoded in parallel, then joined — the same bounded-memory approach the compressor uses — instead of re-encoding the whole file in one pass.

---

## [1.8.0] — 2026-09-06

### Added
- **Merge multiple M4Bs** — a new tool at `/merge-m4b` that combines several M4B/M4A files into one audiobook, ideal for multi-part books. Each file's chapters are shifted onto a single continuous timeline (or you can collapse each file to one chapter). Drag the files into the order you want; they're joined top-to-bottom.
- Smart joining: when the files share the same audio settings they're **stream-copied** together — no re-encode, no quality loss, and near-instant. When they differ, they're re-encoded to a common format so they play back seamlessly, with a clear notice and a bitrate choice.
- Set the combined book's title, author, narrator, year, and genre (prefilled from the first file), and **choose which file's cover to use** — or upload a new one, or remove it.
- The download is named `{Author} - {Title} (merged).m4b` so it won't overwrite the source files, and adding the same file twice is skipped with a notice.
- The homepage and the other M4B tool pages now link to the merge tool, and it's in the sitemap.

---

## [1.7.0] — 2026-09-06

### Added
- **Edit M4B chapters & metadata** — a new tool at `/edit-m4b-chapters` for fixing up an existing audiobook. Drop a finished `.m4b` and you can rename, add, remove, or re-time its chapters, correct the title/author/narrator/year/genre tags, and keep, replace, or remove the cover image. The chapter list re-orders itself by time as you edit, and the first chapter is pinned to the start of the book.
- Because only the markers, tags, and cover change, the audio stream is copied through untouched — no re-encode, no quality loss, and a near-instant save even for a long book. It also works on a chapterless file: add markers from scratch.
- The homepage, the compress page, and the M4B-to-MP3 page now link to the editor, and it's in the sitemap.

---

## [1.6.0] — 2026-09-06

### Changed
- Compressing an M4B is now much faster for chaptered audiobooks: the file is split at its chapter boundaries and the chapters are re-encoded **in parallel** across multiple workers, instead of one serial pass (roughly 2–3× quicker). Chapters, cover art, and metadata are preserved; files without chapters still use the original single-pass path.

### Added
- The compressor and the M4B-to-MP3 splitter now keep your screen awake while they run, so a long job isn't paused by the display going to sleep — matching what the converter already did. (Active while the tab stays in the foreground.)

---

## [1.5.0] — 2026-09-02

### Added
- **M4B to MP3 (split)** — a new tool at `/m4b-to-mp3` that splits an existing M4B audiobook into per-chapter MP3 files (bundled as a ZIP), or into a single MP3 when the file has no chapters. Each MP3 is named and numbered by chapter and tagged with the chapter title, track number, and the book's title and author. Everything runs in your browser; nothing is uploaded.
- Choice of MP3 bitrate (64 / 96 / 128 kbps) with an estimated total size and a chapter-list preview.
- The homepage and the compress page now link to the M4B-to-MP3 tool, and it's in the sitemap.

---

## [1.4.3] — 2026-09-02

### Added
- A favicon / browser-tab icon.
- The FFmpeg engine now starts downloading as soon as you add your first file, so it's usually ready by the time you click Convert instead of stalling on first use.

### Fixed
- The cover preview now shows the image exactly as it will be embedded (letterboxed on white for non-square images) instead of a cropped square.
- A corrupt or unreadable cover image is caught the moment you add it, with a clear message, instead of failing at the end of a conversion.
- Files with an identical size and duration but different names (e.g. fixed-length blocks) are no longer wrongly skipped as duplicates.
- "Skipped file" notices now stay until dismissed, so they aren't missed in a large drop.
- The click-to-browse dialog now filters to supported audio and image types.
- Each file row now shows its duration on mobile too.
- A compressed file downloads as "<name> (compressed).m4b" so it doesn't collide with the original in the same folder.
- Raised the contrast of muted helper text in dark mode to meet WCAG AA.

---

## [1.4.2] — 2026-09-02

### Fixed
- Chapter titles now fall back to the file name when a set of files all share the same embedded title tag (common with MP3 audiobooks), instead of producing a list of identically-named chapters. A unique per-file embedded title is still used when it's present.
- The offline claim is now accurate: the comparison table and FAQ describe the tool as needing no server per conversion and being cached best-effort by your browser, rather than implying a guaranteed offline install.

### Added
- Each file row now shows its filename beneath the chapter title (when they differ), plus a pencil cue and a "click a title to rename" hint so inline editing is discoverable.

---

## [1.4.1] — 2026-09-02

### Fixed
- Output M4B files are now tagged as an **Audiobook** (media type) with gapless playback, so players shelve them under audiobooks and remember the resume position instead of treating them as music. Applies to both the converter and the M4B compressor.
- The "your audiobook is ready" card is now cleared when you change files, metadata, cover, or bitrate after a conversion — previously it could keep offering a download whose filename no longer matched the tags inside the file.
- The year field no longer pre-fills with the current year (which stamped older books with a wrong release date). It starts empty, with the current year shown only as a placeholder hint.
- Privacy policy corrected: the FFmpeg core is served from mp3tom4b's own domain (not a third-party CDN), and the optional online metadata lookup (iTunes / Open Library, located outside the EU) is now disclosed.

### Added
- A warning before closing the tab or navigating away while a conversion or compression is running, so long jobs aren't lost by accident.
- The homepage now links to the format-specific converter pages (FLAC, WAV, M4A, OGG, Opus).

### Changed
- The "Shrink an existing M4B" tab now shows its own how-it-works steps instead of the build-from-files steps.
- Accessibility: drop zones expose a button role and progress bars expose a proper progressbar role with value.

---

## [1.4.0] — 2026-08-25

### Added
- **Compress an existing M4B** — a new mode on the `/compress-m4b` page that shrinks a finished M4B (or M4A) audiobook by re-encoding its audio to a lower bitrate, while keeping its chapters, cover art, and metadata intact. Drop a file to see its duration, chapter count, cover, and current bitrate, pick a target bitrate, and get an estimated output size with the expected space saving ("about 50% smaller").
- Mode toggle on the compress page — "Shrink an existing M4B" (default) and "Build from separate files".
- A "Compress" link in the site header, and a callout on the homepage, pointing to the new compressor.

### Changed
- The `/compress-m4b` page now serves both building a compact M4B from separate files and shrinking an existing one.
- Compression is blocked when the chosen bitrate is not lower than the file's current bitrate, so you can't accidentally re-encode without shrinking.

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
