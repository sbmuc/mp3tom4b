# mp3tom4b — Backlog

Ideas explicitly deferred from V1, organized by priority. Don't expand scope into these without a deliberate decision. After each post-launch iteration, revisit this list against actual user feedback and analytics — don't just work top-down.

---

## V1.1 — Quick wins (1–3 weeks post-launch)

These are small refinements that make the tool feel meaningfully more polished. Pick the ones that real users actually flag — don't build all of them.

### Sort behavior refinements
- **Smart auto-sort detection** — when files form a clean numeric sequence, auto-apply on first drop without user clicking the A→Z button. Detection rule: every filename contains exactly one numeric token, and those tokens form a contiguous or near-contiguous sequence.
- **"Files may be out of order" hint** — small inline link near the sort buttons when the current order doesn't match the natural sort order. Disappears once user clicks sort or manually reorders.
- **Undo affordance** after auto-sort runs ("Restored to drop order") for ~5 seconds.

### Duplicate detection refinements
- **"Add anyway" button** in the duplicate notification for users who genuinely want a duplicate file (rare edge case but real — e.g., bookend chapters, intentional repeats).
- **Optional content hash verification** for cases where size + duration coincidentally match but files are different. Only run on user request, not by default (hashing is slow).

### Code quality / testing
- **Integration test** for the full conversion pipeline using a small fixture audio file.
- **Better error messages** with specific failure modes (corrupt file, unsupported codec, memory exceeded, etc.) instead of generic errors.

### Accessibility
- **Keyboard support for drag-to-reorder** — arrow keys or up/down buttons on each file row to move chapters without using a pointer.
- **Screen reader testing** with VoiceOver and NVDA. Fix any aria-live region issues found during conversion progress.

---

## V1.2 — Polish layer (1–2 months post-launch)

Larger UX improvements that don't fit in quick-fix territory.

### Conversion experience
- **"Continue from where you left off"** recovery if browser crashes mid-conversion. Stores progress in IndexedDB.

### UI / design
- **Mobile experience improvements** — beyond "this works best on desktop." Make tablet usable end-to-end.
- **Drag-and-drop affordance improvements** — more visible reorder handles, smoother animations.

### Multi-source enrichment refinements
- **Source preference setting** — let users default to Open Library if they prefer book-centric data over iTunes audiobook entries. Stored as a per-browser preference (no account).
- **Per-session result cache** — cache lookup results keyed by `{title, author, narrator}` for the lifetime of the tab so repeated lookups (e.g., after editing a chapter title) don't re-hit iTunes / Open Library.
- **Narrator verified vs unverified badge** — distinguish "source confirmed narrator" (rare; would need iTunes to start exposing it or Audnex integration) from "narrator typed by you" so power users see at a glance which fields are externally verified.

### Cover image enhancements
- **Auto-detected cover refinements** — when extracted from audio file, show the source ("from Chapter 01.mp3") so user knows where it came from.
- **Cover image cropping tool** — basic crop UI for non-square covers instead of just padding to white.

### Mixed drop refinements
- **Image dimension-based cover selection** — when multiple images are dropped, load each briefly in an `<img>` element to compare actual pixel dimensions (largest wins after name-priority tiebreak). Current implementation uses file size as a proxy.
- **Visual drag-over hint** — when the user hovers with a mix of audio + image files, show both a music note and image icon in the drop zone to confirm images are accepted. Requires inspecting `dataTransfer.items` during `onDragOver`.
- **Folder confirmation modal** — for large folder drops (>20 files), show a preview ("Found 18 audio files, 1 cover image in "Harry Potter". Add them?") instead of adding immediately. Reduces accidental whole-library drops.
- **`webkitdirectory` fallback** — for click-to-browse, expose an "Add folder" secondary button that opens the file picker with the `webkitdirectory` attribute, for browsers that don't support drag-and-drop of directories.

---

## V2 — Bigger features (3–6 months post-launch)

Features that require meaningful new code or new product thinking. Only build these if V1.x has found an audience.

### Metadata source expansion (still gated by user demand)
iTunes Search and Open Library already ship in V1.1. These would only land if real users specifically ask:
- **Audnex / Audnexus** — community-built unofficial Audible scraper, has narrator data, lives in legal gray zone. Only with explicit "uses unofficial Audible data" opt-in screen, never by default.
- **Google Books API** — free with key, has summaries and ISBNs. Useful as a third book-centric fallback.
- **MusicBrainz** — broader catalog, useful for podcast / lecture metadata where iTunes/OL fall short.
- Power-user setting: pick preferred source order; results merge intelligently with file metadata and user input.

### Project save / resume
- **Browser-storage project save/resume** using IndexedDB. No account, no cloud — entirely local. Lets users come back to an in-progress audiobook setup after closing the tab.
- **"Continue where you left off"** prompt on next visit if a project is in progress.

### Reverse conversion
- **M4B → individual MP3 files** — split an existing M4B back into chapter MP3s. Different ffmpeg pipeline but same wasm engine.

### Internationalization
- **Dutch UI translation** — natural fit given Sebastiaan's market and KvK presence.
- **German UI translation** — large adjacent market, similar audiobook culture.
- **i18n architecture** — set up next-i18next or equivalent so further languages are easy.

### Advanced chapter handling
- **Per-chapter cover art** — different image per chapter, embedded as MP4 chapter atoms.
- **Custom chapter timestamps within a single file** — split one long MP3 into multiple chapters at user-defined times. Different from current "one file = one chapter" model.
- **Chapter-title collision detection** — when multiple files have the same embedded title, warn and offer to deduplicate or rename.

### File handling improvements
- **Larger file support** — investigate ffmpeg.wasm-mt (multithreaded) for files > 1.5GB. Requires COOP/COEP headers (already configured) and SharedArrayBuffer support.
- **Resume after browser crash** — auto-save conversion state every chapter so a refresh doesn't lose progress.

---

## V3 — iOS app

Native SwiftUI app, not a web wrapper. Shares brand and UX patterns with the web version but uses platform-native primitives.

- **SwiftUI + AVFoundation** for encoding (much faster than wasm, no battery drain).
- **File import** from Files app, iCloud Drive, Dropbox.
- **One-time purchase**, ~€4.99 (App Store handles payment).
- **App Store name TBD** — "MP3 to M4B Converter" works for App Store search; sub-brand may be cleaner.
- **Apple Developer account** required — €99/year (only commit to this once V1 web has shown it has an audience).
- **Web version stays free forever** — the iOS app is the monetization path; the web tool is the marketing engine.

---

## V3+ — Adjacent tools (the mp3tom4b constellation)

Only if V1 finds a real audience and there's demand for related utilities. Each tool reuses the existing codebase and brand:

- **M4B chapter editor** — edit chapters in existing M4B files without re-encoding. Different ffmpeg pipeline (chapter atom edit only), much faster.
- **M4B metadata fixer** — batch-fix tags in audiobook libraries. Useful for users with messy collections.
- **M4B splitter** — split a long M4B into chapter MP3s (this is V2's reverse conversion, possibly worth promoting to its own page).
- **Audiobook cover generator** — basic AI-generated or template-based cover creation for user-recorded audiobooks (authors, podcasters).

These could live at sub-paths (`mp3tom4b.com/chapter-editor`) or get their own keyword-targeted domains (`m4bchapters.com`, `audiobooktools.com`).

---

## Won't Do

These are explicitly out of scope. Saying no protects the product:

- **User accounts** — defeats the friction-free positioning, adds infrastructure cost, no clear benefit.
- **Cloud storage / sync** — defeats the privacy promise. The whole point is files don't leave the browser.
- **Server-side conversion** — same reason. If wasm can't handle a file, the user uses a desktop tool. We don't compromise the privacy story.
- **Ads** — free forever, monetization via optional iOS app or donations only. No banner ads, no display ads, no sponsored placements.
- **Premium tier on the web tool** — accounts + payment + support overhead erodes the brand for marginal revenue. iOS app is the right place to charge.
- **AI-generated chapter titles** — overkill, filename-based + embedded metadata is fine.
- **Voice cloning / TTS narration** — different product entirely, not in scope.
- **Real-time collaboration** — single-user tool, no need.
- **Browser extensions** — no clear use case for this kind of tool.

---

## Decision log (things we've already decided against)

These came up during planning and got rejected with clear reasoning. Recorded so they don't get re-debated.

- **"Same as source" bitrate option** — misleading, since every input is re-encoded to AAC regardless of source format. Either wastes space (re-encoding 320 kbps MP3 to 320 kbps AAC) or produces meaningless results for lossless inputs. Use smart default + advanced options instead.
- **m4bforge brand** — "Forge" naming collided with existing products (ChapterForge, audiobook-forge). Switched to mp3tom4b.com for SEO clarity.
- **Force auto-sort with no manual override** — breaks legitimate use cases (Prologue/Epilogue, intentional reverse order). Manual drag-to-reorder remains the override.
- **Confirmation dialog on duplicate detection** — too much friction for the common case. Silent skip + dismissible notification is the right tradeoff.
- **Server-side fallback for large files** — undermines the privacy story which is the entire differentiator.

---

## How to use this backlog

1. **After 2-3 weeks of real user feedback**, revisit V1.1 and pick 3-5 items that real users have asked for. Build those. Ship. Iterate.
2. **Don't pull from V2 until V1.x is stable** and the tool has at least a few weeks of traffic data.
3. **V3 (iOS) is the monetization commitment** — only start it once the web version has proven there's audience demand.
4. **The "Won't Do" list is sacred** — items there should require strong evidence to revisit, not just a passing thought.
5. **When in doubt, prefer shipping less.** A small, working V1.1 ships faster than a sprawling one and gives you faster feedback for V1.2.
