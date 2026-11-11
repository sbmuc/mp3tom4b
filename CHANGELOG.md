# Changelog

> New entries go on top. Each entry should be user-facing language describing the change. Implementation details belong in commit messages, not here.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to semantic-ish versioning.

---

## [1.20.0] — 2026-11-10

### Added
- **More audio formats.** Besides MP3, M4A, WAV, FLAC, OGG and Opus, the converter and Add chapters now take AAC, AIFF, WMA, WebM, MKA and MP2 files, and the sound of an MP4 video such as a recorded lecture. They were turned away as "not audio" although the converter could read them all.
- **32 and 48 kbps.** A book that is already 32 kbps (many older rips are) now gets 32 kbps by default, with a note saying why. At 64 it came out twice its size and sounded no better. The compressor offers 32 and 48 kbps too, so a 64 kbps book can still be made smaller.
- **Damaged files are pointed out.** When part of a file can't be read, the chapter comes out shorter than the file: a 30-second file became a 15-second chapter without a word. The result now names such chapters, with how long they are and should be, so you can check them in the preview.

### Fixed
- **No more endless "Downloading converter… 2%".** When the converter itself couldn't be downloaded (offline, or blocked by an ad blocker or a network filter), every tool sat still, or said your file was damaged. They now say the download failed and what to check, and trying again works.
- **Changing a title, a tag or the cover after converting no longer means converting again.** The change is put on the finished M4B in a moment ("Update M4B"), without encoding the audio again. Sorting the list after converting now also clears the old download, which used to stay up as if it were current.
- **One long file converts about twice as fast.** A book that is one long file used one processor core while the others sat idle. It is now cut into pieces that are encoded side by side (an hour of speech: 64 s before, 31 s now), and the cuts are placed in the pauses, so no join can be heard. The longest files also start first, so a long file at the end of a book no longer keeps the others waiting.
- **Sharper covers.** Covers were re-compressed twice, the second time at a low quality, and small covers were enlarged to 1200×1200, which made the file bigger without adding detail. A cover is now saved once at high quality, at its own size up to 1200×1200. The cover zone also takes WebP, GIF and BMP images, which it used to ignore without a message. iPhone HEIC photos get a message explaining that only Safari can open them.
- **Copy-protected books are named as such.** Audible (.aa, .aax) and iTunes Store (.m4p) files now get a message that they are DRM-protected, instead of "not audio". An M4B dropped on the converter links to the M4B tools.
- **Screen readers name the chapter you move.** Reordering by keyboard used to announce internal ids ("Draggable item 9f9c… was dropped over droppable area 1b7d…"); it now says the chapter's title and its new position.
- The converter's first download is about 10 MB, not 31 MB as the label said (it is compressed on the way).
- A chapter title left blank is written as "Chapter N", as in the editor.
- In Safari, closing a preview while it was still loading (for example by sorting the list after converting) logged an error; the player now lets go of the file first.

---

## [1.19.2] — 2026-11-09

### Fixed
- **Out-of-memory failures in Safari and Firefox are recognised.** Each browser words them differently ("Out of bounds memory access" in Safari, "index out of bounds" in Firefox); they showed a technical message instead of the advice to close other tabs or pick a lower bitrate. They now get the advice, like Chrome.
- **A damaged or DRM-protected file says so.** When most of a file can't be decoded (seen with an M4B after 17 minutes), the message now says it may be damaged or protected with DRM, like books bought from Audible, which no converter can open.
- The site has a favicon.ico for browsers and services that look for one.

### Changed
- Failure counts also carry the browser's name for the error (such as "RangeError"), from a fixed list, so the remaining unexplained failures can be told apart. The privacy policy says so.

---

## [1.19.1] — 2026-11-06

### Security
- **The browser now enforces the privacy promise.** A Content Security Policy only lets the site's pages connect to the site itself and, for the optional metadata lookup, to iTunes and Open Library; any other connection is blocked by the browser. The privacy policy and the FAQ say so.
- The anonymous-usage script (Umami) is now a reviewed copy on this site instead of being fetched live from Umami, so it can only change through a reviewed update. (Umami's own copy changed on 5 November.)
- Standard security headers: no MIME sniffing, a stricter referrer policy, unused browser features (camera, microphone, location, payment, USB) switched off, and the site can't be framed by other sites.

---

## [1.19.0] — 2026-11-06

### Added
- **A note when a higher bitrate won't help.** Converting 64 kbps MP3s at 256 kbps makes the M4B bigger, not better; the bitrate picker now says so and offers the setting that keeps everything ("Use 64 kbps"). It also explains when the sample rate is the limit: on 22 kHz audio the encoder tops out at about 110 kbps, whatever you pick.

- **A warning before a book that is likely too big for the browser.** Above about 2 GB the M4B may not come together: a 3.8 GB book failed after an hour of encoding. The bitrate picker now warns before you start, with the size at 64 kbps.

### Fixed
- **The size estimate matches what you get.** It assumed the chosen bitrate, but on 22 kHz audio 256 kbps comes out at about 110 kbps, so a book estimated at 5.3 GB came out at 1.9 GB. The estimate now uses what the encoder really reaches.
- **A clear message when a book is too big after all.** Instead of a technical "NotReadableError" when joining the chapters, it says the book is too big for the browser and what to do. A source file moved or deleted mid-conversion is reported as such too.
- **A closer time estimate when files differ.** A file being encoded is now projected at its own pace: 22 kHz mono chapters took twice as long per minute of audio as a 44.1 kHz file, which made the estimate about half an hour too high on a mixed set.

---

## [1.18.2] — 2026-11-05

### Fixed
- **A steadier "time remaining".** With chapters of very different lengths, say short chapters and one file of 11 hours, the estimate could jump from 11 minutes to an hour and back. Progress now counts each file by its length, and the estimate plans the remaining files over the parallel encoders, so it sees a long last file coming. It also counts down smoothly instead of standing still and jumping.
- **More out-of-memory failures are recognised.** ffmpeg words some of them differently ("Error allocating…"); they now get the advice to close other tabs or pick a lower bitrate too.

---

## [1.18.1] — 2026-11-04

### Fixed
- **Trying again after a failure now works in the same tab.** When a conversion failed, for example because the browser ran out of memory, a second attempt could fail straight away until the page was reloaded. Every tool now starts the next attempt fresh.
- **Running out of memory is recognised as such.** Some memory failures showed a cryptic message instead of the advice to close other tabs or pick a lower bitrate; they now get that advice. A damaged input file is reported as one too.
- **M4B to MP3 uses far less memory on long books.** The MP3s go into the ZIP as they are made, instead of all of them being held in memory and then copied once more into the ZIP.

### Changed
- Failure counts now also carry the encoder's error code and the step that failed (never a file or chapter name), so problems can be found and fixed. The privacy policy says so.

---

## [1.18.0] — 2026-11-03

### Added
- **The M4B player picks up where you left off.** Open the same file again and it continues where you stopped, with a button to start from the beginning instead. Your place is kept only in your browser on this device, under a scrambled code rather than the file name, and is forgotten when you finish the book. The privacy policy says so.
- **Edit chapters & tags, straight from the result.** Every tool that makes an M4B now has a button that opens the finished file in the editor, so fixing a chapter title, a tag or the cover takes seconds, without downloading and dropping it again.

### Changed
- **Chapter titles without track numbers.** When every file's title starts with its number, like LibriVox's "01 - The Happy Prince", the number is left out: "The Happy Prince". Titles where only some start with a number, like "1984", are kept as they are, and so are numbers that are all that tells the chapters apart ("01 Book Title", "1 of 3").

---

## [1.17.0] — 2026-11-03

### Added
- **Guides.** Three new pages, linked from every page's footer: *M4B on iPhone* (Apple Books from a Mac or a Windows PC, or BookPlayer without a computer), *M4B on Android* (getting the file over, and Voice or another audiobook app), and *LibriVox to M4B* (the converter, with how to turn a LibriVox ZIP and its cover into one M4B). "Where to listen" and the FAQ link to them.

### Fixed
- After dropping a ZIP with a cover next to it, the notice no longer says the cover came from the ZIP.

---

## [1.16.0] — 2026-11-03

### Added
- **Where to listen.** Every new audiobook (from the converter, the merger and Add chapters) now comes with a short guide to getting it into Apple Books on a Mac, onto an iPhone, iPad or Android phone, into Audiobookshelf, or into the site's own M4B player. The FAQ answers the same question.
- When a tool fails, the error now says where to report it if it keeps happening: a GitHub issue or an email.

### Changed
- Clicking Convert while a file can't be read now takes you to that file and its remove button, instead of to the top of the page.
- On phones and tablets the drop zones say "Tap to choose …" instead of "Drop …, or click to browse".
- The example values in the book details ("e.g. The Hobbit") no longer look like filled-in fields.

---

## [1.15.0] — 2026-11-03

### Added
- **Cue sheets give exact chapters.** Drop one long audio file together with its .cue file (the cue sheet rippers like EAC, foobar2000 and XLD write) and every track becomes a chapter, with its exact time and title, instead of guessing from silences. On the homepage the note says how many chapters the cue sheet has and opens Add chapters with them filled in; on Add chapters you can drop the audio and the .cue together. The cue sheet's title and performer fill the book's title and author when the file has no tags. Cue sheets in older encodings and inside ZIPs work too; cue sheets that span several files (one per CD) aren't supported yet and are reported instead of being silently skipped.

---

## [1.14.0] — 2026-11-02

### Added
- **One long file? The converter now points you to chapters.** The converter makes one chapter per file, so a single long MP3 came out as one chapter (GitHub issue #1). When you drop one file of 15 minutes or more, a note offers "Add chapters to this file": it opens Add chapters with that file, the details you filled in, and the cover you dropped, so you can put chapters at the pauses or every few minutes without dropping anything again.
- The homepage's first-visit note and the FAQ say how to get chapters into one long file.

---

## [1.13.0] — 2026-11-01

### Changed
- Runs on Next.js 16 and React 19. Next.js 14 no longer gets security fixes; with this update the site's dependencies have no known vulnerabilities. Nothing changes in how the tools work.

---

## [1.12.2] — 2026-11-01

### Changed
- **Anonymous counts of finished and failed conversions.** Besides page views, the site now counts per tool whether a conversion finished or failed, with figures like the number of files, the bitrate, the book's length and, for a failure, the kind of error (for example "out of memory"). This uses Umami, which sets no cookies; it never receives your audio, file names, metadata, or covers, and browsers that send Do Not Track aren't counted. The privacy policy explains it.

---

## [1.12.1] — 2026-11-01

### Fixed
- Every page now shows its own link and the mp3tom4b image when shared on social media or in a chat. The tool and format pages had no image, and the About, FAQ, and Privacy pages pointed to the homepage.
- Screen readers announce what each file picker is for, and grey text and buttons in light mode have enough contrast to read. The "m4b" in the logo is a shade darker in light mode for the same reason.
- The homepage's main heading now says what the site does ("Convert MP3 to M4B audiobooks without uploading a single byte") instead of just the name; it looks the same.
- Updated the audio tag reader to a version that fixes a hang on deliberately malformed files.

---

## [1.12.0] — 2026-11-01

### Added
- **A Tools menu in the header.** Every page now links to all seven tools (convert, compress, edit, merge, M4B to MP3, add chapters, player), each with a one-line description. Before, the header only linked to the compressor.
- **"Add chapters" says what silence detection found.** After a scan, a line explains how many pauses it found and how many chapters it made, or why it made none. A new "Shortest chapter" setting (1 minute by default) controls how close together chapters may be. A scan that finds nothing no longer clears the chapters you already had.

### Fixed
- **A cover dropped together with the audio is kept.** If the MP3s carried their own cover art, it replaced the image you dropped alongside them, and dropping the image again said "Cover already set". Your dropped image now wins over art embedded in the audio; only a cover you picked in the Cover image section takes priority over a drop.
- **The site works in in-app browsers.** Opening mp3tom4b from the Reddit, Instagram, or Facebook app could show "Your browser is missing the APIs we need", because the site still required a browser feature it no longer uses. The warning now only appears when a browser really can't run the converter.

---

## [1.11.1] — 2026-10-27

### Fixed
- **Cover art no longer breaks a conversion.** The FFmpeg engine's JPEG encoder has a bug that real covers can trigger while being embedded. With such a cover the converter stopped with "Your browser ran out of memory", even for a 20-second file. The compressor, merger, "Add chapters", and the chapter editor (when it replaced a cover) stopped the same way or never finished; compressing a 9½-hour audiobook with its cover hung at "Finalizing". Covers are now embedded with standard JPEG tables, which don't have the bug. They look the same and come out about the same size.

### Changed
- The M4B player page now says up front that it plays M4B files on Windows, Mac, and phones, and explains how to skip between chapters.
- The chapter editor page is now titled "M4B Editor" and explains how to change an audiobook's cover.
- The compressor page explains step by step how to compress an audiobook. It no longer says the size depends on mono or stereo, or that the compressor makes mono files: only bitrate and length decide the size, and the compressor keeps the channels as they are.

---

## [1.11.0] — 2026-10-26

### Added
- **Drop a ZIP.** The converter and the merge tool take ZIP files as you downloaded them, from Google Drive, Dropbox, LibriVox or elsewhere. The audio inside is unpacked in your browser, in folder and name order, and a cover image in the ZIP becomes the cover. Several ZIPs can be dropped at once, so a book that Google Drive split across downloads comes together again. A 1 GB ZIP unpacks in about ten seconds, without being loaded into memory.

### Changed
- Dropping an M4B on the converter now says it's already an audiobook and points to the M4B tools, instead of calling it "not audio".

---

## [1.10.5] — 2026-10-26

### Fixed
- **The M4B tools need much less memory too.** The compressor, chapter editor, merger, M4B-to-MP3 splitter, and "Add chapters" loaded the whole audiobook into memory before starting, and some kept extra copies along the way. They now read your files from disk as they're needed and hand finished pieces to the browser straight away. With a 233 MB audiobook, the file data held at once roughly halves: editing 466 → 233 MB, compressing 485 → 252 MB, merging two copies 939 → 473 MB, and splitting into MP3s 248 → 16 MB. Speed is unchanged.
- Dropping a large M4B into a tool no longer loads the whole file just to read its chapters and length, so its details show up sooner.

---

## [1.10.4] — 2026-10-26

### Fixed
- **Merging M4B files dropped in together keeps each file's own chapters.** When several files were dropped at once, they were read at the same moment and could pick up each other's details: every part could show the last file's chapter titles, chapter count, or length, so the merged book got the wrong chapter names and, with parts of different lengths, chapters in the wrong place. Files are now read one after another.

---

## [1.10.3] — 2026-10-26

### Fixed
- **No more "Ran out of memory" after many steps.** The FFmpeg engine didn't fully clean up after each step it ran, and after about 65 MP3 encodes it crashed, even with hardly any memory in use. Splitting a book with more than about 60 chapters into MP3s failed this way every time, and converting several books in a row, or a book made of hundreds of files, could fail too. The engine now cleans up after every step; a 120-chapter book splits fine.
- **Long audiobooks need much less memory to convert.** The converter used to load every source file into memory and keep every finished chapter, the whole audiobook, and two extra copies of it there at once, so long books (and especially one long MP3) could end in "Ran out of memory". Source files are now read from your disk as they're needed, finished chapters are handed to the browser straight away, and the audiobook is copied out once. Converting a 10-hour book now keeps about half as much in memory while it's joined, and a single long file no longer has to fit in memory before converting starts.
- The out-of-memory message now says what helps: close other tabs, pick a lower bitrate, or convert a shorter audiobook. How many files you drop in makes no difference.
- A conversion that fails while joining no longer leaves its half-written audiobook in memory.

### Changed
- The FAQ explains what the memory needed depends on (the length of the finished book and the bitrate) and what to do if a conversion runs out of memory.

---

## [1.10.2] — 2026-10-13

### Changed
- The homepage's title in search results is shorter, so "Free, No Upload" is no longer cut off. It now reads "Convert MP3 to M4B Audiobook Online — Free, No Upload".
- The sitemap now gives each page the date its content last changed, instead of stamping every page with the date of the latest deploy.
- The search-result descriptions of the tool and format pages are shorter (under 160 characters), so search engines show them in full instead of cutting them off.

---

## [1.10.1] — 2026-10-12

### Fixed
- **"Look up online" finds the book when the author is written another way.** Searching "Harry Potter and the Half-Blood Prince" by "Joanne K. Rowling" listed only biographies of her, because iTunes knows her as "J.K. Rowling", and the search stopped there. Authors and narrators are now searched by surname, a search that finds only other books makes way for the next one, and the likeliest book comes first, ahead of summaries and study guides of it.
- Author and Narrator are swapped back whenever the book found names the narrator field's person as its author, however the name is spelled, not only after a narrator search.

---

## [1.10.0] — 2026-10-09

### Added
- **Preview before you download.** Every tool that makes an M4B (the converter, compressor, chapter editor, merger, and "Add chapters") now has a preview under the download button. Play the result right in the page, see its chapter list, and jump between chapters to check they start where they should, before the file goes to your phone.
- **M4B player** at `/m4b-player`: drop an M4B, M4A, or MP3 and play it in the browser with its cover, chapter list, chapter skipping, 15 s back / 30 s forward, and 0.75×–2× speed. Media keys and the phone lock screen control it too. The file plays from your device; nothing is uploaded or stored.

### Changed
- Every page's list of M4B tools now links to the player.

---

## [1.9.3] — 2026-09-26

### Fixed
- **Compressing an M4B and adding chapters to one long file now keep every chapter marker on its audio.** Both tools re-encode the book in pieces, and each piece comes out a few hundredths of a second longer. The markers used to stay at their old times, so they slipped further ahead of the audio with every chapter — roughly a second every 50 chapters — and skipping to a late chapter landed in the end of the one before.
- The progress label no longer says "Downloading converter (one-time, ~31 MB)…" on every visit; once the converter has loaded in your browser, later visits just say "Loading converter…".

### Changed
- Every format page (FLAC, WAV, M4A, OGG, Opus to M4B) now links to all the M4B tools, and the compressor page lists them under their own heading.

---

## [1.9.2] — 2026-09-22

### Fixed
- **Files with different audio settings now join cleanly.** A chapter recorded at another sample rate (say one 48 kHz file among 44.1 kHz MP3s) used to play slightly low and slow, and a mono file among stereo ones could make Apple's player stop reading the audiobook partway. Every chapter is now encoded to one common format first.
- **Chapter markers land where each chapter actually starts.** They used to slip a little further ahead of the audio with every chapter — roughly a second every 30 chapters — so skipping to a late chapter in a long book landed in the end of the previous one.
- M4A files are only copied without re-encoding when they already match each other and the bitrate you picked. Otherwise they're re-encoded, so the result has the bitrate you chose and the size estimate holds (previously a set of 256 kbps M4As stayed at 256 kbps whatever you selected).
- A backslash in the book title, author, or narrator (e.g. "AC\DC") is no longer dropped.

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
