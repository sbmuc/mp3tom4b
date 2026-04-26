# mp3tom4b — Claude Code Bootstrap Sequence

This document gives you the exact sequence of prompts to run in Claude Code to build V1 from scratch. Each step produces working, testable code before moving to the next.

## Prerequisites

- Domain purchased: mp3tom4b.com ✅
- GitHub repo created: `burcevski/mp3tom4b` (recommend public for transparency)
- Local clone with `CLAUDE.md`, `BACKLOG.md`, and `README.md` already committed
- Node 20+ installed
- Vercel account linked to the GitHub repo

---

## Session 1 — Project Skeleton (~30 min)

> "Read CLAUDE.md. Initialize a Next.js 14 project with TypeScript, Tailwind CSS, and App Router in the current directory. Install these dependencies: @ffmpeg/ffmpeg, @ffmpeg/util, react-dropzone, @dnd-kit/core, @dnd-kit/sortable, lucide-react, zustand. Set up the folder structure under `src/` exactly as specified in CLAUDE.md. Create empty placeholder files for every component and lib file listed in the structure. Add a basic Header, Footer, and HeroSection that renders 'mp3tom4b' as the wordmark and the tagline 'Drag your audio files in. Get an M4B audiobook out. Your files never leave your browser.' Configure Tailwind with dark mode set to 'class' and add a basic color palette using zinc neutrals. Confirm the dev server runs and shows the placeholder homepage."

**Verify:** `npm run dev` shows a styled homepage with header, hero, footer.

---

## Session 2 — Drop Zone & File List (~45 min)

> "Implement the DropZone component using react-dropzone. Accept these audio MIME types: audio/mpeg, audio/mp4, audio/x-m4a, audio/wav, audio/flac, audio/ogg, audio/opus. Show clear visual feedback during drag-over. On drop, add files to a Zustand store in `lib/store/conversionStore.ts`. Implement FileList and FileListItem components that render the dropped files with: filename, file size, duration (placeholder for now), edit-title input, and remove button. Use dnd-kit to enable drag-to-reorder. Auto-generate chapter titles from filenames (strip extension, replace _ and - with spaces, title-case). Make the entire flow accessible: keyboard reordering, ARIA labels. Also implement the PrivacyBadge component as a small reusable callout that says 'Your files never leave your browser' and place one instance directly under the drop zone."

**Verify:** Drop multiple audio files, see them listed, reorder them, edit chapter titles, remove individual files. Privacy badge visible.

---

## Session 3 — Metadata Form & Cover Upload (~30 min)

> "Build the MetadataForm component with fields: title (required), author (required), narrator (optional), year (optional, numeric, 1900–2099, defaults to current year), genre (dropdown: Audiobook/Podcast/Lecture/Other, default Audiobook). Use controlled inputs wired to the Zustand store. Add inline validation. Build the CoverUpload component: drag-or-click for JPG/PNG, show 200x200 preview, store the File in the store. Add `lib/image/resize.ts` with a function that takes a File and returns a JPEG Blob resized to 1200x1200 max (preserve aspect ratio, white background for non-square). Use canvas API. Don't run the resize yet — just have the function ready."

**Verify:** Form validates correctly, cover preview displays, no console errors.

---

## Session 4 — ffmpeg.wasm Integration (~60 min, the big one)

> "Implement `lib/ffmpeg/client.ts` as a singleton that lazy-loads ffmpeg.wasm on first use. Use the @ffmpeg/ffmpeg single-threaded core for maximum browser compatibility. Implement `lib/ffmpeg/probe.ts` to extract duration from each input file. Implement `lib/ffmpeg/chapters.ts` to generate an ffmetadata-format chapter file from the file list. Implement `lib/ffmpeg/convert.ts` as the main pipeline: load ffmpeg, probe each file, generate chapters, re-encode each input to AAC at the chosen bitrate, concatenate, mux with cover art and metadata into MP4 container, output as Blob with .m4b extension. Emit progress events that the UI can subscribe to. Don't wire up the UI yet — write a small test page at `/test-convert` that runs a hardcoded conversion and downloads the result."

**Verify:** Visit `/test-convert`, get a working M4B file out. Open it in a player (VLC or Apple Books) to confirm chapters and cover art work.

---

## Session 5 — Wire Up Conversion UI (~45 min)

> "Build the ConvertButton, ProgressBar, and DownloadCard components. Wire them to the conversion pipeline from Session 4. ConvertButton is disabled unless: at least 1 file present, title filled, author filled. On click, run the full conversion. Show ProgressBar with current step text and percentage. On success, show DownloadCard with a big download button (filename: `{Author} - {Title}.m4b`) and a 'Start over' button that resets the store. Handle errors gracefully — show a clear message inline, don't lose the user's input. Remove the `/test-convert` page."

**Verify:** Full happy path works end-to-end on the homepage. Bad path (corrupt file, missing metadata) shows clear errors.

---

## Session 6 — Polish, SEO, and Static Pages (~45 min)

> "The homepage IS the keyword-targeted page since the domain is mp3tom4b.com. Update the hero copy to naturally include the phrase 'Convert MP3 to M4B' and emphasize the no-upload differentiator. Add a short 'How it works' section below the tool (3 steps with icons: Drop files → Add metadata → Download M4B). Below that, add a 'Why mp3tom4b?' section explicitly contrasting with upload-based converters. Build /about, /faq, and /privacy pages with content. The /faq page should answer: what is M4B, why convert, is it really private, what file types are supported, file size limits, browser compatibility, what happens if I close the tab, can I use this offline. Add full Open Graph + Twitter Card metadata. Add JSON-LD SoftwareApplication schema on the homepage and FAQPage schema on /faq. Generate sitemap.xml and robots.txt. Add Vercel Analytics. Polish dark mode across all pages. Add a 'Built in Amersfoort by Burcevski ICT' line in the footer with a link to burcevski.nl, plus a link to the GitHub repo and a copyright line including KvK 74404172."

**Verify:** All pages render in light and dark mode, social share previews look good (test with Vercel preview URL in a Slack DM to yourself), Lighthouse SEO score > 95.

---

## Session 7 — Deploy & Configure DNS (~20 min)

> Outside Claude Code:
> 1. Push to GitHub `main` branch.
> 2. Vercel auto-deploys.
> 3. In Vercel project settings → Domains, add `mp3tom4b.com` and `www.mp3tom4b.com`. Set one as canonical (recommend non-www).
> 4. At your domain registrar, follow Vercel's DNS instructions: typically an A record pointing the apex to Vercel's IP, and a CNAME for `www`. Cloudflare Registrar plays nicely here.
> 5. Wait for SSL provisioning (~5 min).

**Verify:** mp3tom4b.com loads with valid SSL, real conversion works on the live site, www variant redirects to apex (or vice versa, whichever you chose).

---

## Total V1 build estimate

Roughly 4–5 hours of focused work spread across a weekend. Realistic for two evenings if everything goes smoothly.

## After V1 ships

1. Submit sitemap to Google Search Console.
2. Submit to Bing Webmaster Tools too — small audience but easy win.
3. Submit to a few free tool directories: AlternativeTo, various "free online tools" lists.
4. Post once on relevant subreddits with a focus on the privacy angle: r/audiobooks, r/selfhosted, r/privacy, r/webdev. Be transparent: "I built this, free, no signup, no upload, code on GitHub."
5. Don't post on Product Hunt yet — wait until you have a few weeks of polish and real user feedback.
6. Don't touch features for 2 weeks. Watch analytics. Fix bugs reported by real users. Then revisit V1.1 backlog.
