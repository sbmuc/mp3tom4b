# Features

What mp3tom4b does today, in present tense. No history, no roadmap — see [CHANGELOG.md](CHANGELOG.md) for what shipped when, and [BACKLOG.md](BACKLOG.md) for what's next.

---

## File handling

- Drag-and-drop input for MP3, M4A, WAV, FLAC, OGG and Opus files, and also AAC, AIFF, WMA, WebM, MKA, MP2 and the audio of MP4 videos (`AUDIO_EXTENSIONS` in `src/lib/audio/validate.ts`, shared by the converter and Add chapters), or ZIP archives of them (unpacked in the browser, in folder and name order; a cover image inside is used as the cover; several ZIPs, like Google Drive's split downloads, can be dropped at once).
- Click-to-browse fallback for users who prefer the OS file picker.
- Multi-file drop in a single action.
- Mixed drop — drop audio files and a cover image together; each is routed automatically.
- Folder drop — drop an entire audiobook folder; nested files are flattened, hidden files (`.DS_Store`, `__MACOSX`) are skipped, and the best image inside is picked as the cover.
- Best-cover selection rules — when multiple images are dropped, the file named `cover.*` / `folder.*` / `front.*` / `album.*` wins, with file size as a tiebreaker.
- Duplicate detection — files with matching size + duration are skipped silently, and the existing matching row briefly flashes to show what matched.
- Skipped files are always reported by name — non-audio files (`.txt`, `.pdf`, cue sheets) and rejected audio alike, including when a drop contains nothing usable. Hidden files stay silent. Copy-protected books (Audible `.aa`/`.aax`/`.aaxc`, iTunes Store `.m4p`), loose or in a ZIP, are named as DRM-protected; an M4B gets links to the editor, compressor, merger and splitter.
- Unreadable files are caught on drop: when neither the tags nor the browser can decode a file, the row is flagged and converting is blocked until it's removed.
- Mixed-album warning when dropped files appear to come from different audiobooks based on their `album` tags.
- Per-file remove button.
- Drag-to-reorder file list (each file becomes one chapter in list order).
- Natural-order sort (Chapter 2 before Chapter 10) with A→Z / Z→A sort buttons; manual reorder switches to a "custom" order that no longer auto-sorts.

## Chapters

- Cue sheets: a `.cue` dropped with one audio file (loose or in a ZIP) is read in the browser (`src/lib/audio/cue.ts`: UTF-8 or Windows-1252, INDEX 01 times in 1/75 s frames, minutes past 99). On the homepage it turns the single-file note into "This file has a cue sheet with N chapters" and goes along to Add chapters; on Add chapters, dropping audio plus `.cue` fills the chapter list with the tracks' titles and times (whole seconds, rounded down; tracks past the end or in the same second are left out and counted), and the sheet's TITLE/PERFORMER fill the title and author when the file has no tags. Sheets that span several files are reported and not used.
- One long file: when the converter holds a single file of 15 minutes or more, a note offers "Add chapters to this file", which opens Add chapters with the same file, the fields the user typed or looked up, and a dropped cover (handed over in memory by `src/lib/handoff.ts`; nothing is stored or uploaded).
- Shared track numbers are left out of chapter titles: when every readable file in a drop starts with a distinct number of up to three digits ("01 - The Happy Prince", "3. Home", "07 Finale"), the number is dropped (`stripTrackNumbers` in `src/lib/audio/format.ts`). A lone "1984" among plain titles stays, and so does a number that is all that tells the titles apart ("01 Book Title", "1 of 3", "1 John"); the list still sorts by file name.
- Chapter title auto-generated from each filename (extension stripped, separators normalised, title-cased).
- Embedded `title` tag is used as the chapter title only when it is unique across the dropped files; otherwise the filename is used, so a set that shares one album/book title doesn't become a run of identical chapters.
- Each row shows the source filename beneath the title when they differ, with a pencil cue and hint making it clear titles are click-to-edit.
- Inline chapter title editing with keyboard navigation: Arrow/Enter moves to the next chapter, Shift+Enter or ArrowUp moves to the previous.
- Per-row "reset to original" button when a chapter title has been edited.

## Metadata

- Form fields: title (required), author (required), narrator, year, genre.
- Year: any four digits, or empty (`isValidYear` in `src/lib/audio/year.ts`, the same rule in every tool), so a LibriVox classic can carry 1851. A wrong one is marked and holds Convert back until it is fixed. The field's placeholder is an example ("e.g. 1937"), not a value.
- Genre dropdown: Audiobook (default), Podcast, Lecture, Other.
- Auto-fill from the first dropped file's embedded tags — title, author, narrator, year, genre, and cover art populate any empty/untouched fields.
- "Verify metadata → Look up online" — searches iTunes Search first, then falls back to Open Library when iTunes has no match. Only title, author, and narrator are sent over the network; audio files never leave the browser.
  - People are searched by surname, so "Joanne K. Rowling" finds books listed under "J.K. Rowling".
  - A search only counts when a result has most of the title's words; otherwise the next search runs (narrator, then title alone, then Open Library), so a search that finds only other books (biographies of the author, say) doesn't hide the book.
  - Results are listed best first: the title's words and little else, by the author searched for. A study guide or summary of the book comes after the book itself.
  - When the author picked is the person in the narrator field (however each spells the name) and the author field held someone else, Author and Narrator are swapped back.
- Per-source result badges ("from iTunes" / "from Open Library") on fields populated from a verified lookup.
- One-click cover apply from an iTunes match.

## Cover image

- Any image the browser can decode — JPG, PNG, WebP, GIF (first frame), BMP, AVIF — via the cover zone, a mixed drop, or the editor's, merger's and Add chapters' cover pickers (`coverProblem` in `src/lib/image/validate.ts`). A HEIC photo that the browser can't open (all but Safari) gets a message saying so, and how to save it as JPG.
- Live preview that mirrors the embedded result (letterboxed on a white background for non-square images), so what you see is what gets embedded.
- Corrupt or unreadable images are rejected the moment they are added, rather than failing at the end of a conversion.
- Saved once as a square JPEG at its own size, up to 1200×1200 (never enlarged), at quality 0.9, stepping down to 0.75 only above 500 KB; non-square images are padded onto a white background. That JPEG is copied into the M4B as it is (`OWN_COVER_ARGS`), not encoded again. A cover kept from an input file (compressor, merger) is encoded with the standard Huffman tables (`COVER_CODEC_ARGS`).
- Source badge on the cover preview ("from drop" or "from audio file") so users see at a glance how the cover was set.
- Precedence: a cover picked in the Cover image section beats one dropped with the audio, which beats the one embedded in the audio. A dropped image replaces an embedded or earlier dropped cover; only a picked cover makes a drop say "Cover already set".
- Remove-cover button.

## Conversion

- Bitrate selector: 32, 48, 64 (default), 96, 128, 192, 256 kbps.
- Smart bitrate default — when every file is lossy at 48 kbps or less, the smallest setting that keeps them (32 or 48) is picked, with a line saying why (at 64 such a book came out twice its size and no better); when source files are lossless or above 256 kbps and the genre is non-audiobook, it is bumped to 96.
- Estimated output size preview that updates with bitrate changes ("~340 MB at 64 kbps"), at the bitrate the encoder really reaches: it tops out by sample rate (`aacCeilingKbps`, measured: ~110 kbps at 22 kHz, ~220 at 44.1 kHz), so 256 kbps on 22 kHz audio is shown as "at ~112 kbps".
- When the chosen bitrate is higher than the audio can use, a note says why and offers the setting that keeps everything (`bitrateAdvice`): the files are lossy at a lower bitrate ("Your audio is 64 kbps, so a higher bitrate makes the M4B bigger, not better"), or their sample rate caps the encoder.
- Above about 2 GB estimated (`LIKELY_TOO_BIG_BYTES`), a warning before converting that the book may not come together in the browser, with its size at 64 kbps.
- Mixed sources join cleanly: every chapter is encoded to one common sample rate (the highest source rate, up to 48 kHz) and channel layout (mono only when every source is mono), so files from different rips, recorders, or formats can be combined.
- AAC `.m4a` inputs that already share identical audio settings and are at or below the chosen bitrate are joined without re-encoding (no quality loss, near-instant); the audio settings are confirmed with ffmpeg first, not taken from the tags.
- Chapter markers are placed from each encoded chapter's real length, so they stay aligned with the audio at every chapter of a long book.
- A long file is shared between the workers (`src/lib/ffmpeg/pieces.ts`): a file longer than 20 minutes and longer than a worker's share of the book is cut into up to one piece per worker. The cuts go in the middle of the pause (at least 0.4 s at −35 dB, found with a `silencedetect` pass) nearest each even split point, because every join adds about 30 ms of near-silence; a split point with no pause within 5 minutes is skipped. Each worker decodes the file from the start and trims its piece (`atrim`), so the cut is sample-exact, also in a VBR MP3. The longest jobs are encoded first.
- A chapter that comes out much shorter than its file says (under 90% and at least 3 s short: part of the file couldn't be decoded, which ffmpeg skips without failing) is named on the result card with both lengths (`findShortChapters`).
- Memory use follows the finished audiobook, not the sources: source files are read straight from disk as ffmpeg needs them, each encoded chapter is handed to the browser as soon as it is done, and the result is copied out once. Joining takes two to three times the size of the finished M4B.
- Multi-stage progress bar with human-readable labels (loading ffmpeg, probing, encoding chapter X of Y, muxing, finalizing).
- Estimated time remaining while encoding: progress weighs each file by its length (`encodeWeights`), and the time left plays out the remaining files over the workers at the pace measured per worker (`simulateEncodeMs`), so one long file at the end is foreseen instead of making the estimate jump; a file in progress is projected at its own pace once it has shown one. It counts down every second between updates.
- ffmpeg.wasm runs entirely in-browser; nothing is uploaded.
- Output is a single M4B file with chapter markers, embedded cover art, and full audiobook metadata, optimised for streaming/seek (`+faststart`).
- Output is tagged as an Audiobook (media type `stik=2`) with gapless playback, so players shelve it under audiobooks and keep the resume position.
- Warns before you close the tab or navigate away while a conversion or compression is still running.
- Every step that must succeed runs through `runFFmpeg` (`src/lib/ffmpeg/run.ts`): a non-zero ffmpeg exit stops the run there, named by what ffmpeg logged (out of memory, unreadable input, or the exit code), instead of failing a step later on a missing output. The log is only read in the page, never sent.
- Errors are recognised in every browser engine's own words (Chrome/Edge/Opera, Safari, Firefox): out of memory gets the memory advice, a mostly undecodable file (ffmpeg exit 69) says it may be damaged or DRM-protected, a stack overflow says so.
- After a failed run (not a cancel) every tool starts the next on a fresh engine (`resetFFmpegAfterFailure`), so a retry in the same tab gets all the memory again.
- When the engine itself can't be downloaded (offline, an ad or content blocker, an HTTP error), every tool says so (`EngineLoadError`, `loadEngine` in `src/lib/ffmpeg/engine.ts`) instead of hanging at "Downloading converter… 2%" or blaming the file, and the next try starts the download again.

## Split an M4B (M4B → MP3)

- Available at `/m4b-to-mp3`: drop a finished `.m4b` / `.m4a` and it is probed in-browser for its chapter list.
- Each chapter is re-encoded to an MP3 (64 / 96 / 128 kbps), named and numbered by chapter, and the set is bundled into a ZIP for download. Names are cut at about 80 characters, at a word (`safeFileName` in `src/lib/format/fileName.ts`), so the ZIP unzips on every system; the full title stays in the MP3's tags.
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

- Available at `/merge-m4b`: drop two or more `.m4b` / `.m4a` files (loose or in ZIPs) and each is probed in-browser for its chapters, length, audio settings, and cover.
- Drag-to-reorder the files (keyboard-accessible); they are joined top-to-bottom.
- Each file's chapters are shifted onto one continuous timeline, or optionally collapsed to a single chapter per file. A chapterless file becomes one chapter titled after it.
- Compatible files (same codec/sample rate/channels) are stream-copied together — no re-encode, no quality loss, near-instant; mismatched files are re-encoded to a common AAC target (with a notice and a bitrate choice).
- Set the combined book's title/author/narrator/year/genre (prefilled from the first file); pick which input file's cover to use, upload a new one, or remove it.
- Duplicate files (same name + size) are skipped with a notice; the download is named `{Author} - {Title} (merged).m4b` to avoid overwriting the sources.
- Runs entirely in the browser via WebAssembly — the files are never uploaded.

## Add chapters to a single file

- Available at `/add-chapters-to-mp3`: drop one long audio file (any format the converter takes, or an M4B) and turn it into a chaptered M4B.
- A file that already has chapters (an M4B's, or an MP3's ID3 chapters) opens with them in the list, titles included, read the way the player reads them, without the engine (`readPlaybackInfo`). A cue sheet dropped with it wins.
- Three ways to set chapter marks: split evenly into a number of chapters (or one every N minutes), auto-detect chapters from the silent pauses (`silencedetect`, opt-in — a full decode pass with progress + wake lock; pause length and shortest chapter are adjustable, and a line afterwards says how many pauses were found, used and skipped), or enter/adjust the times by hand.
- Editable chapter table (reused from the editor): first chapter pinned to 0:00:00, add/remove, auto-sort by time, live validation.
- Metadata form (prefilled from the file) and cover (keep the file's own, upload a new image, or remove).
- Bitrate 32 / 48 / 64 / 96 / 128 kbps (a file of 48 kbps or less starts on the setting that keeps it); the audio stays one continuous stream with chapter markers added over it.
- Long files are split into chapter-sized pieces and re-encoded in parallel (bounded memory + faster); short files use a single pass. Chapter markers are moved by each re-encoded piece's real length (measured from where the split actually cut), so they stay on the audio at every chapter.
- Runs entirely in the browser via WebAssembly — the file is never uploaded.

## Download

- Auto-generated filename in `{Author} - {Title}.m4b` format, each part cut at about 80 characters (`safeFileName`, used for every tool's download name).
- Custom filename input — override the auto-generated name; the `.m4b` extension is added if missing, and a "reset" button restores the auto name.
- "Start over" button to clear all state and begin a new conversion.
- Changing a chapter title, a tag or the cover after converting keeps the M4B: the button becomes "Update M4B", which puts the changes on it in a remux with the audio copied (`editM4B`, `LastBuild` in the store), in a moment instead of a new encode. Adding, removing or reordering files, or another bitrate, needs a new conversion; the old M4B is then let go before encoding, and sorting clears the result too.
- "Edit chapters & tags" on every result card that makes an M4B (converter, compressor, merger, add-chapters) opens the finished file in the editor, handed over in memory (`src/lib/handoff.ts`), so a fix doesn't need a download, a new drop, or another conversion.
- "Where to listen" with every new book (converter, merger, add-chapters): how to get the M4B into Apple Books on a Mac, onto an iPhone or iPad (Finder sync, or the Files app plus a player like BookPlayer), onto Android (Voice, Smart AudioBook Player), into Audiobookshelf, or into the site's own M4B player. The FAQ has the same answer, and the iPhone and Android rows link to their guides.
- Preview: play the result in the page before downloading (chapter list, chapter skipping, speed) to check the chapters land on the audio. Offered on every tool that produces an M4B: converter, compressor, chapter editor, merger, and add-chapters.

## Compress an existing M4B

- Available on the `/compress-m4b` page via a mode toggle: "Shrink an existing M4B" (default) or "Build from separate files".
- Drop a single finished `.m4b` / `.m4a`, whatever audio it holds (AAC, ALAC, or MP3, which some tools put in an M4B); the file is probed in-browser for its duration, chapter count, cover presence, and current bitrate.
- Re-encodes only the audio stream to a lower AAC bitrate (32 / 48 / 64 / 96 / 128 kbps) while keeping the original chapters, cover art, and metadata untouched. A book already at about 64 kbps or less starts on the highest setting that still shrinks it (`defaultCompressBitrate`).
- Chaptered books are split at chapter boundaries and re-encoded in parallel across workers (~2–3× faster); chapterless files use a single serial pass. The original chapter markers are moved by each re-encoded piece's real length, so they stay on the audio; titles and tags are kept as they were.
- Estimated output size and expected space saving ("about 50% smaller") update with the chosen bitrate.
- Compression is disabled when the chosen bitrate wouldn't make the file noticeably smaller (it must be at most 90% of the current bitrate); a book already at about the lowest setting is told so.
- Download filename derived from the file's embedded tags (`{Author} - {Title}.m4b`), falling back to the original name.
- Like the main converter, everything runs in the browser — the file is never uploaded.

## M4B player

- Available at `/m4b-player`: drop an `.m4b`, `.m4a`, or `.mp3` and it plays in the browser's own audio element from a local `blob:` URL — nothing is uploaded.
- Shows the cover, title, author, narrator, chapter count, and length from the file's tags.
- Chapter list with the playing chapter highlighted and kept in view; click a chapter to play from its start. Chapters come from the MP4 chapter track (falling back to the Nero `chpl` box) or from MP3 ID3 chapters, read without loading ffmpeg.
- Previous / next chapter ("previous" restarts the current chapter after its first 3 seconds), 15 s back, 30 s forward, a seek bar over the whole book, time left in the chapter, and 0.75×–2× speed.
- Lock-screen, headset, and media-key controls via the Media Session API, with the chapter title and cover shown.
- Files without chapters get a pointer to the chapter editor (M4B) or "Add chapters to MP3" (MP3).
- Picks up where you left off: the position per book is kept in this browser's localStorage under a SHA-256 of the file name and size (`src/lib/audio/resume.ts`), saved every 5 s, on pause and when the page closes, cleared at the end; the 50 most recently played books are kept. Reopening the file jumps there (not within 30 s of either end) with a "Start from the beginning" button. Previews on the tool pages don't remember.
- The same player powers the download preview on every M4B tool.
- An audio format the browser can't play (mostly ALAC in an M4B or M4A) gets a message pointing to Safari, or to the compressor, which turns it into AAC and keeps the chapters, tags and cover.

## UI / UX

- Header "Tools" menu listing all seven tools with a one-line description, on every page (Escape or a click outside closes it; full width on phones).
- Drop zone with a privacy line directly underneath ("Your files never leave your browser: nothing is uploaded."), said again in the footer, which also has a contact address.
- On phones the converter's file list puts each file's length under its title, so the title keeps room (about twice what it had).
- First-time visitor hint on the empty drop zone — short explainer of what M4B is, with a link to the FAQ.
- Dismissible drop notices ("Used X as cover", "Cover already set", "N files skipped") that auto-dismiss after 6 seconds.
- Dark mode that activates automatically based on operating-system preference.
- Responsive layout that works on tablet; desktop is the optimised target.
- Works in in-app browsers (Reddit, Instagram, Facebook): the single-threaded engine needs only WebAssembly and Web Workers, so the site sends no COOP/COEP headers and only warns when one of those two is missing.
- Keyboard-accessible interactive elements; ARIA labels on icon-only buttons and on every file input; light-mode text and icon buttons meet WCAG AA contrast (the wordmark's "m4b" is accent-700 in light mode).
- aria-live progress announcements during conversion.
- Keeps the screen awake during conversion, compression, and splitting (while the tab is in the foreground) so a long job isn't interrupted by display sleep.
- Estimated time remaining on every long-running tool (`useEta`), from the average pace since the step started moving rather than the last few updates, counting down every second; parallel chapter encodes weigh each chapter by its size.
- The one-time engine download (about 10 MB compressed, 32 MB unpacked) is named in the progress label on first use, rather than looking like a stall; later visits (served from the browser cache) just say "Loading converter…".
- Touch-sized (44px) drag, reset, and remove controls.
- Keyboard reordering (converter list, merger) is announced with the item's title and position ("Intro moved to position 3 of 6"), not dnd-kit's internal ids (`src/lib/a11y/sortAnnouncements.ts`).
- Drop zones say "Tap to choose …" on phones and tablets (no mouse, a finger as the main pointer) and "Drop …, or click to browse" elsewhere.
- Clicking Convert before it's ready goes to the first thing missing: the empty drop zone, the unreadable file's remove button, or the title or author field.
- The metadata form's example values read "e.g. The Hobbit", so they aren't mistaken for filled-in fields.
- When a tool fails, the error says where to report it if it keeps happening (a GitHub issue or an email), without sending anything itself.

## Pages

- Homepage `/` is the converter itself — no marketing wall, no sign-up.
- `/about` — how the tool works and why it runs client-side.
- `/faq` — common questions about M4B, audiobooks, and the conversion process.
- `/privacy` — privacy policy.
- Five SEO sister landing pages with format-specific hero copy and FAQ: `/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`, `/opus-to-m4b`.
- Every landing page cross-links the other formats and the M4B tools ("More M4B tools").
- `/compress-m4b` — landing page for shrinking or building a compact M4B, with the compressor and build tool behind a mode toggle.
- `/m4b-to-mp3` — landing page for splitting an M4B into per-chapter MP3s.
- `/edit-m4b-chapters` — landing page for editing chapters, metadata, and cover art in an existing M4B.
- `/merge-m4b` — landing page for merging several M4B files into one audiobook.
- `/add-chapters-to-mp3` — landing page for turning a single audio file into a chaptered M4B.
- `/m4b-player` — landing page for playing an M4B audiobook in the browser.
- `/librivox-to-m4b` — the converter with a LibriVox hero and steps: check for LibriVox's own M4B first, then drop the "Whole book (zip file)" and the cover art (the ZIP holds only the MP3s), type the narrator; with a FAQ on public domain, group readers and bitrate.
- Guides `/m4b-on-iphone` (Apple Books via Finder on a Mac or iTunes on Windows, or BookPlayer from the Files app) and `/m4b-on-android` (USB or cloud, then Voice or another audiobook app), each with troubleshooting links to Add chapters, the editor and the compressor.
- Every page's footer has a Guides row; guide pages link each other and the main tools ("More guides and tools") and carry FAQPage structured data.

## SEO

- Open Graph and Twitter Card metadata on every page, each with its own og:url and the share image (`src/lib/seo/social.ts`; a page's own `openGraph` replaces the root's rather than merging, so every page goes through that helper).
- The homepage H1 is the sentence "Convert MP3 to M4B audiobooks without uploading a single byte"; the wordmark above it is styled text, not the heading.
- JSON-LD `SoftwareApplication` schema on the homepage.
- JSON-LD `FAQPage` schema on the FAQ page and each sister landing page.
- Sitemap.xml covering all routes, each with the date its content last changed.
- IndexNow: after each successful production deploy, a GitHub Action submits the pages whose sitemap date is today or yesterday, so Bing (and DuckDuckGo, Yahoo, Ecosia) recrawl them right away.
- robots.txt.

## Privacy

- All file processing happens in the browser via WebAssembly. No file is uploaded.
- The only network calls during normal use are: loading the page itself, loading ffmpeg.wasm on first conversion, and (only on explicit "Look up online" click) sending title/author/narrator to iTunes Search and/or Open Library.
- Cookieless analytics: Vercel Analytics for page views, visitors, countries and referrers, and Umami (`src/lib/analytics.ts`) for anonymous per-tool events only (its automatic page views are off, because through the proxy it sees Vercel's IP, not the visitor's): success, and failure with the kind of error (`failureReason`: out_of_memory, unreadable_input, damaged_input, ffmpeg_exit, file_system, engine_stopped, engine_download, browser_storage, source_moved, stack_overflow, interrupted, other) plus ffmpeg's exit code, the converter's step and the error's class from a fixed list where known (`failureDetails`), never the message, carrying counts, sizes, durations and settings, never file names or content. Umami is served through `/stats` on our own domain, counts only www.mp3tom4b.com, and honours Do Not Track.
- The only thing kept between visits is the M4B player's position per book, in localStorage on the device, keyed by a hash rather than the file name (plus a flag that the engine was downloaded before).
- Content Security Policy (next.config.js): pages may connect only to this site, iTunes Search, Open Library and iTunes artwork (`*.mzstatic.com`); scripts only from this site (plus inline Next bootstrap, `blob:` and `wasm-unsafe-eval` for the ffmpeg worker); media and images from `blob:`; no framing. Not applied in `next dev`; preview deploys also allow Vercel's toolbar. Every tool runs under it in the browser tests.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` switching off camera, microphone, geolocation, payment and USB, `X-Frame-Options: DENY`, no `X-Powered-By`.
- The Umami tracker is a pinned, reviewed copy at `public/stats/script.js` (header comment: source, date, sha256 of the original); only its event endpoint is proxied.
- No third-party tracking scripts, no ads, no sign-up.
- Source code is open on GitHub for independent auditing.

## Quality

- TypeScript strict mode across the codebase.
- Vitest unit tests covering chapter generation, file validation, metadata extraction, image resize, bitrate logic, ETA formatting, MP4 duration parsing, MP4 chapter reading (chapter track and `chpl`), player chapter navigation, and how inputs are joined.
- CI (`.github/workflows/ci.yml`): lint, typecheck, unit and integration tests, and browser smoke tests, on every push to `main`/`dev` and every pull request.
- Browser smoke tests (`npm run test:e2e`, Playwright, `e2e/`): every page loads, the Tools menu, and each of the seven tools end to end in a real Chrome on files generated with the site's own ffmpeg-core (a dropped cover beating embedded art, chapters in the preview, silence detection, playback). Requests to Umami and Vercel Analytics are blocked so test runs never count.
- Production check (`.github/workflows/production-check.yml`): the same browser tests against www.mp3tom4b.com daily at 06:00 UTC, after every production deploy, and on demand; a failure emails the owner with the Playwright report attached.
- Real-file tests (`npm run test:real`, `REAL_FULL=1` for whole books) that run every tool on the owner's own audiobooks, kept outside the repo and skipped when absent: two very different MP3 rips, 9- and 27-hour M4Bs from other tools, an 11-hour single MP3, and Google Drive ZIPs.
- Integration tests (`npm run test:integration`) that run the real converter, compressor, chapterizer, and MP3 splitter against the shipped ffmpeg-core in Node: mixed sample rates, mono among stereo, chapter-marker accuracy (never after the sound, no drift), the M4A copy path, a long file cut into pieces only in its pauses (`longFile.test.ts`: no gap where pieces join, markers after it still on the audio), a partly damaged file reported as short, metadata escaping, a 120-chapter split on one instance, nothing left behind after a failed join, files dropped together each read correctly, and covers embedded and kept — checking decode errors, pitch per chapter, and marker positions, and on macOS also decoding the result with Apple's own decoder.
- The ffmpeg-core JS is patched (`scripts/patch-ffmpeg-core.mjs`): one instance can run any number of commands (the stock core crashed after about 65 MP3 encodes), and mounted files are read 1 MB at a time instead of 32 KB, so reading from disk is as fast as reading from memory. Covers are encoded with standard JPEG Huffman tables (`src/lib/ffmpeg/cover.ts`): the core's optimal-table encoder overruns its buffer on many real covers.
- Every tool mounts its inputs instead of copying them in (`src/lib/ffmpeg/files.ts`): ffmpeg reads them from disk as it needs them, intermediate pieces go to the browser as Blobs, and each output is read out once.
- Lighthouse-targeted performance: instant first paint, ffmpeg.wasm loaded lazily on first conversion and cached thereafter.
