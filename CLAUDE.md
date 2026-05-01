# mp3tom4b — CLAUDE.md

## Project documentation

This project keeps a clean separation of past, present, and future across four files. **CLAUDE.md** (this file) is the architectural and scope source of truth — read it first to understand why decisions were made and what's in/out of scope. **FEATURES.md** is the present-tense inventory of what the product does today; consult it before adding something to confirm whether it already exists. **CHANGELOG.md** is the historical record of what shipped when, in user-facing language, newest-first; append a new entry when work ships. **BACKLOG.md** is the forward-looking list of deferred ideas, organised by version (V1.1 / V1.2 / V2 / V3 / Won't Do); pull from here, don't expand scope inline.

## Project Overview

**mp3tom4b** is a free, browser-based tool that converts audio files (MP3, M4A, WAV, FLAC, OGG, Opus) into M4B audiobook files with chapters and embedded cover art. All conversion happens client-side via ffmpeg.wasm — no files are uploaded to any server.

- **Domain:** mp3tom4b.com
- **Owner:** Burcevski ICT (Sebastiaan Burcevski)
- **Repo name:** `mp3tom4b`
- **License:** TBD (likely MIT for code)

## Why This Exists

There is a real, persistent gap in the audiobook creation space:

- **Existing web converters all upload your files.** Vertopal, CloudConvert, Movavi, Media.io, FreeConvert, audiobook-converter.com — every browser-based competitor processes files server-side. For audiobook collectors, this is a privacy concern and often a speed bottleneck.
- **Existing local tools require installation.** ChapterForge ($9.99 desktop app), m4b-tool (CLI), AudioBookConverter (Java app), audiobook-forge (Rust CLI) — all require downloading, installing, and either paying or being technical enough to use a terminal.
- **Apple Books / iTunes workflows are clunky.** Renaming MP3s, dragging into iTunes, marking as audiobook, transferring back out — works, but tedious and Mac-only.

mp3tom4b solves this with a clean, drag-and-drop browser tool where files truly never leave the user's machine. **This is the only differentiator that matters in our positioning.**

## Core Value Proposition

> "Drag your audio files in. Get an M4B audiobook out. Your files never leave your browser."

This privacy-first, friction-free positioning is the foundational marketing message and must appear prominently on the page.

## Competitive Positioning

We are NOT competing with ChapterForge on features — they have batch processing, project save/resume, advanced metadata, regex find-and-replace, and a polished native app. We will not match those in V1 and probably never will.

We ARE differentiated on:

1. **No installation.** A URL is faster than a download.
2. **Genuinely client-side.** Other web converters say "secure" but still upload. We don't upload at all. Files never touch any server.
3. **Free, forever, no signup.** No "convert your first file free, then pay" patterns.
4. **No size or count limits beyond what the browser can handle.** No "premium plan" upsell.
5. **Open source.** Code on GitHub, auditable, forkable. Reinforces the privacy claim.

When in doubt about a feature, ask: does this strengthen or weaken our differentiation? A "save project to cloud" feature would technically be useful but contradicts the privacy promise. Skip it.

## Target Users

1. **Audiobook hobbyists** digitizing physical audiobooks or organizing personal libraries.
2. **Podcast archivists** bundling episode collections into a single chaptered file.
3. **Self-publishing authors/narrators** who want a quick way to create M4B preview files.
4. **Educators/course creators** packaging audio lessons.
5. **Privacy-conscious users** who specifically don't want to upload files to strangers.

Users skew technical-curious but not necessarily developers. UX must be obvious without instructions.

---

## Technical Architecture

### Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Language:** TypeScript (strict mode)
- **Encoder:** @ffmpeg/ffmpeg + @ffmpeg/util (WebAssembly)
- **File handling:** react-dropzone for drag-and-drop
- **Drag-to-reorder:** dnd-kit (@dnd-kit/core, @dnd-kit/sortable)
- **Icons:** lucide-react
- **State:** Zustand (lightweight, no boilerplate)
- **Hosting:** Vercel (free tier)
- **Analytics:** Vercel Analytics (free tier) — privacy-respecting, no cookies needed

### Why client-side?

- **Privacy as the entire product.** It's not a feature, it's the reason to use this over the alternatives.
- **Zero infrastructure cost** — no server, no upload bandwidth, no abuse surface.
- **Trivial deployment** — `git push` to Vercel.
- **Tradeoff accepted:** ffmpeg.wasm is ~3–5x slower than native, capped around 2GB memory. Acceptable for typical audiobooks (<12 hours, MP3 input). Edge cases get a clear warning.

### Project Structure

```
mp3tom4b/
├── CLAUDE.md                       # This file
├── README.md                       # Public-facing project intro
├── BACKLOG.md                      # Deferred ideas
├── BOOTSTRAP.md                    # Build sequence for Claude Code
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.local.example
├── .gitignore
├── public/
│   ├── favicon.ico
│   ├── og-image.png                # Open Graph share image
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, metadata, analytics
│   │   ├── page.tsx                # Main tool page (homepage IS the converter)
│   │   ├── about/
│   │   │   └── page.tsx            # About / how it works / privacy
│   │   ├── faq/
│   │   │   └── page.tsx
│   │   ├── privacy/
│   │   │   └── page.tsx            # Privacy policy
│   │   └── globals.css
│   ├── components/
│   │   ├── DropZone.tsx            # Drag-and-drop file input
│   │   ├── FileList.tsx            # Reorderable list of audio files
│   │   ├── FileListItem.tsx        # Single file row with edit/remove
│   │   ├── MetadataForm.tsx        # Title, author, narrator, year, genre
│   │   ├── CoverUpload.tsx         # Cover image upload + preview
│   │   ├── BitrateSelector.tsx     # 64 / 96 / 128 kbps
│   │   ├── ConvertButton.tsx       # Trigger + progress display
│   │   ├── ProgressBar.tsx         # Visual conversion progress
│   │   ├── DownloadCard.tsx        # Post-conversion download UI
│   │   ├── PrivacyBadge.tsx        # Reusable "files stay in your browser" callout
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── HeroSection.tsx
│   ├── lib/
│   │   ├── ffmpeg/
│   │   │   ├── client.ts           # ffmpeg.wasm singleton + lifecycle
│   │   │   ├── convert.ts          # Main conversion orchestration
│   │   │   ├── chapters.ts         # ffmetadata file generation
│   │   │   ├── probe.ts            # Get duration + metadata from input files
│   │   │   └── types.ts
│   │   ├── audio/
│   │   │   ├── validate.ts         # File type / size validation
│   │   │   └── format.ts           # Format helpers (duration display, etc.)
│   │   ├── image/
│   │   │   └── resize.ts           # Cover art resize to 1200x1200 JPEG
│   │   └── store/
│   │       └── conversionStore.ts  # Zustand store
│   └── types/
│       └── index.ts                # Shared TypeScript types
└── tests/
    └── (TBD — Vitest for unit tests on lib/)
```

---

## Features — V1 Scope

### Must-Have (ship blockers)

1. **Drag-and-drop file zone** — accepts MP3, M4A, WAV, FLAC, OGG, Opus. Multiple files at once. Click-to-browse fallback.
2. **File list with drag-to-reorder** — each file becomes one chapter, in list order.
3. **Auto-generated chapter titles from filenames** — strip extension, replace underscores/hyphens with spaces, title-case. Editable inline.
4. **Per-file remove button.**
5. **Metadata form:**
   - Audiobook title (required)
   - Author (required)
   - Narrator (optional)
   - Year (optional, 4-digit)
   - Genre (optional, dropdown: Audiobook, Podcast, Lecture, Other)
6. **Cover image upload** — JPG or PNG, drag or click. Preview thumbnail. Auto-resize to 1200x1200 JPEG before embedding.
7. **Bitrate selector** — 64 kbps (default for spoken word), 96 kbps, 128 kbps.
8. **Convert button** — disabled until at least 1 file + title + author present.
9. **Progress bar** — show current step (loading ffmpeg, decoding, encoding chapter X of Y, muxing, finalizing). Percentage where possible.
10. **Download M4B file** — auto-named from `{Author} - {Title}.m4b`. Big "Download" button.
11. **Reset / Start over button** after download.
12. **Privacy badge prominently displayed** — at least near the drop zone and in the footer.

### Won't-Have in V1 (explicitly deferred)

- User accounts
- Saved projects / browser-storage persistence
- Server-side conversion fallback
- Custom chapter timestamps within a single file
- Multi-language UI (English only at launch; Dutch later)
- M4B → MP3 reverse conversion
- Per-chapter cover art
- Variable bitrate / advanced encoder settings
- Batch conversion of multiple audiobooks at once
- Audible/Audnex metadata lookup (ChapterForge does this, we don't need to)

These are tracked in `BACKLOG.md` for future versions.

---

## UX Principles

1. **The tool is the homepage.** No sign-up wall, no marketing fluff above the fold. Hero text + the drop zone, immediately usable. The domain name already explains what the tool does — don't waste the fold on explanation.
2. **Privacy stated prominently.** "Your files never leave your browser" appears at least twice — once near the drop zone, once in the footer. This is THE differentiator.
3. **Sensible defaults.** Bitrate 64 kbps preselected (audiobook standard). Genre defaults to "Audiobook." Year defaults to current year.
4. **No surprises.** Show estimated output file size before encoding. Show estimated time during encoding.
5. **Failure is informative.** If a file is corrupt, too large, or unsupported, say exactly that — don't show a generic error.
6. **Mobile-aware.** Tool is usable on tablet. On phones, show a friendly "this tool works best on desktop" message but don't block usage.
7. **No dark patterns.** No "convert 1 file free, sign up for more" tricks. No fake progress bars. No artificial delays.

---

## Design Direction

The product name is descriptive and utility-focused. The visual language should match: clean, fast, technical. Think developer-tool aesthetic, not consumer-app aesthetic.

- **Tone:** clean, technical, trustworthy, slightly nerdy. Closer to a tool a power-user would screenshot to a friend than something marketed on Instagram.
- **Color palette:**
  - Primary accent: TBD — pick one. Suggested directions: cyan/teal (technical, clean), deep blue (trustworthy), or a slightly warm green (friendly utility). Avoid red/orange (alarm).
  - Neutrals: zinc/slate grayscale
  - Background: white (light mode), zinc-950 (dark mode)
- **Typography:** Inter for UI, JetBrains Mono for technical details (file sizes, bitrates, durations).
- **Dark mode:** required from launch. Default to system preference.
- **No stock photography.** Custom small illustrations or icon-only.
- **Logo:** text wordmark for V1. Lowercase `mp3tom4b` set in Inter or a similar geometric sans, with the `m4b` portion potentially in the accent color to give it a subtle visual hook. No icon mark needed yet.

---

## Conversion Pipeline (Technical Detail)

For each conversion job:

1. **Initialize ffmpeg.wasm** (lazy-load on first conversion, cache thereafter).
2. **Probe each input file** — get duration via `ffprobe`-equivalent commands. Build a chapter timeline:
   ```
   Chapter 1: 00:00:00 → 00:23:14  "Introduction"
   Chapter 2: 00:23:14 → 01:05:42  "Chapter One"
   ...
   ```
3. **Generate ffmetadata file** in memory with chapter markers.
4. **Re-encode each input to AAC** at the chosen bitrate (mono if source is mono, stereo otherwise).
5. **Concatenate AAC streams** using ffmpeg's concat demuxer.
6. **Process cover image** — resize to 1200x1200 JPEG, max ~200KB.
7. **Mux into MP4 container** with:
   - Audio stream
   - Cover art (as `mjpeg` attached pic)
   - Metadata (title, artist, album_artist, date, genre)
   - Chapter markers from ffmetadata file
8. **Rename output to .m4b** and trigger browser download via Blob + object URL.
9. **Clean up** — release ffmpeg memory, revoke object URLs.

### Key ffmpeg flags reference

```
-f concat -safe 0 -i filelist.txt    # concatenate inputs
-i cover.jpg                          # cover input
-map 0:a -map 1                       # audio + image streams
-c:a aac -b:a 64k                     # AAC encoding
-c:v copy -disposition:v attached_pic # cover as attached picture
-f ffmetadata -i chapters.txt         # chapter metadata
-metadata title="..." -metadata artist="..."
-movflags +faststart                  # optimize for streaming/seek
output.m4b
```

---

## Performance Targets

- **First Contentful Paint:** < 1.5s on 4G
- **ffmpeg.wasm load:** < 5s on first use, cached thereafter
- **Conversion speed:** roughly real-time-divided-by-3 (a 3-hour audiobook converts in ~1 hour worst case, much faster typically)
- **Memory:** support audiobooks up to ~12 hours / 1.5GB total input on modern desktop browsers; show clear warnings beyond that

---

## SEO Strategy

The domain itself is the primary SEO asset — exact-match for the highest-intent query in this niche.

### Primary keywords

- "mp3 to m4b" (exact-match domain advantage)
- "convert mp3 to m4b"
- "create m4b audiobook"
- "m4b converter online"
- "audiobook converter free"
- "mp3 to m4b without upload" (unique angle)
- "private audiobook converter" (unique angle)

### Page strategy

- `mp3tom4b.com/` — homepage IS the tool AND the SEO landing page. Hero text uses the primary keywords naturally.
- `mp3tom4b.com/about` — how it works, why client-side, who built it. Useful for E-E-A-T signals.
- `mp3tom4b.com/faq` — captures long-tail "how do I" queries.
- `mp3tom4b.com/privacy` — privacy policy (required, also strengthens the privacy positioning).

### Schema / metadata

- Open Graph + Twitter Card on every page
- JSON-LD `SoftwareApplication` schema on the homepage
- `FAQPage` schema on the FAQ page
- Sitemap.xml + robots.txt

### Content angle that beats competitors

ChapterForge ranks for these queries with paid Medium articles. Vertopal, CloudConvert etc. rank with their domain authority. We win by:

1. **Exact-match domain for the primary query** — search engines weight this heavily for utility tools.
2. **Single, focused page** — not buried under marketing fluff.
3. **Speed** — Lighthouse score 95+ ranks better.
4. **Unique angle in title/meta** — "Convert MP3 to M4B online — without uploading your files."

### Content expansion (post-V1)

Sister landing pages on the same domain for `flac-to-m4b`, `wav-to-m4b`, `m4a-to-m4b` — same tool, different SEO targets, minimal additional code. Each gets its own `/page-name` route with keyword-targeted hero.

---

## Accessibility

- Semantic HTML (proper heading hierarchy, button vs. anchor distinction).
- All interactive elements keyboard-accessible.
- Drag-and-drop list reorder must have keyboard alternative (arrow keys or up/down buttons).
- ARIA labels on icon-only buttons.
- Color contrast WCAG AA minimum.
- Progress updates announced via `aria-live` regions.
- Tested with VoiceOver on macOS at minimum.

---

## Privacy & Legal

- **No tracking cookies.** Vercel Analytics is cookieless; if Plausible is added later, it's also cookieless.
- **No file uploads.** This is the core promise. Communicate it clearly on the homepage and explain on /about how it works (ffmpeg.wasm runs in-browser).
- **AVG/GDPR posture:** since no personal data is collected, processed, or stored, the privacy policy is short and simple. Still required to have one.
- **Footer must include:** Privacy Policy link, copyright line ("© 2026 Burcevski ICT"), KvK number (74404172), contact email, link to GitHub repo.
- **Cookie banner:** not needed if only Vercel Analytics is used (cookieless). If Google Analytics is ever added — banner required. Don't add GA.
- **Open source the code.** Publish the repo publicly on GitHub. This is itself a privacy proof — anyone can audit that no upload happens. Add a clear LICENSE file (MIT recommended for the code).

---

## Development Workflow

### Local dev

```bash
npm install
npm run dev          # http://localhost:3000
```

### Required Node version

Node 20 LTS or newer.

### Branching

- `main` — production, auto-deploys to Vercel
- `dev` — integration branch, auto-deploys to a Vercel preview URL
- Feature branches → PR into `dev`

### Commit style

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`).

### Code style

- Prettier + ESLint with Next.js defaults.
- TypeScript strict mode, no `any` without explicit reason in a comment.
- Components: function components only, no class components.
- File naming: PascalCase for components, camelCase for utilities, kebab-case for routes.

---

## Testing Strategy (V1.1+)

V1 ships without a test suite to keep scope tight. Once V1 is live and stable, add:

- **Unit tests** (Vitest) for `lib/ffmpeg/chapters.ts`, `lib/audio/validate.ts`, `lib/image/resize.ts`.
- **Integration test** for the full conversion pipeline using a small fixture audio file.
- **E2E** (Playwright) for the happy-path flow: drop file → fill metadata → convert → download.

---

## Roadmap

### V1 (launch)

Drag-and-drop, multi-file, chapters from filenames, cover art, metadata, M4B output.

### V1.1

- Vitest test suite
- Better error messages
- Drag-and-drop reorder keyboard support
- Sister SEO pages (flac-to-m4b, wav-to-m4b, etc.)

### V1.2

- Inline chapter title editing improvements
- Estimated time remaining during conversion
- Custom output filename input
- Dark mode polish

### V2

- Browser-storage project save/resume (IndexedDB, no account needed) — must remain local-only to preserve privacy promise
- Reverse conversion: M4B → individual MP3s
- Chapter image support
- Dutch + German UI translations

### V3 — iOS app

- Native SwiftUI app using AVFoundation for encoding (much faster than wasm)
- App Store name TBD — "MP3 to M4B" works for App Store search but a sub-brand may be cleaner
- File import from Files app, iCloud Drive, Dropbox
- One-time purchase, ~€4.99
- Apple Developer account required (€99/year)

### V3+ — Adjacent tools

If V1 finds an audience, expand the domain into a small constellation:
- M4B chapter editor (edit chapters in existing M4B files)
- M4B metadata fixer (batch-fix tags in audiobook libraries)
- M4B splitter (split a long M4B into chapter-MP3s)

These could live at sub-paths on mp3tom4b.com or get their own descriptive domains.

---

## Success Metrics

This is a side project, not a startup. Metrics are about validation, not growth-hacking.

**Year 1 targets (if it goes well):**
- 1,000+ unique visitors/month by month 6
- 100+ successful conversions/month
- A handful of "thank you" emails / GitHub stars
- Ranking page 1 of Google for "mp3 to m4b" within 12 months (exact-match domain helps)

**Honest baseline:** even if traffic stays modest, the tool itself is useful, the codebase is portfolio-grade, and the iOS port path is open. There's no failure mode that wastes meaningful resources.

---

## Open Questions / Decisions to Revisit

- [ ] Final accent color choice
- [ ] Plausible Analytics later, or stick with Vercel Analytics?
- [ ] Add a "Buy me a coffee" / Ko-fi link in footer post-launch, or keep it 100% free with no monetization signals?
- [ ] License the code as MIT on GitHub from day one (recommended) or keep private until V1 ships?
- [ ] iOS app branding when we get there — same name or sub-brand?

---

## Working with Claude Code on This Project

When prompting Claude Code:

1. **Always reference this CLAUDE.md** — it's the source of truth for scope and architecture.
2. **Stay in the V1 lane.** If a feature isn't in "V1 Must-Have," push back and add it to BACKLOG.md instead.
3. **Prefer the boring choice.** This is utility software. Stable, well-known libraries beat clever new ones.
4. **Ask for tests on lib/ functions** even though V1 ships without a full suite — pure functions in `lib/ffmpeg/`, `lib/audio/`, `lib/image/` should have unit tests from the start.
5. **No new dependencies without justification.** Each package added is weight on the wasm bundle and load time.
6. **The privacy claim is a contract.** No analytics that ping on file selection, no error reporting that sends file metadata, no third-party scripts that could read DOM contents. If something would break the "files never leave your browser" promise, it doesn't ship. This isn't paranoia — it's literally the entire reason this tool exists instead of using CloudConvert.
