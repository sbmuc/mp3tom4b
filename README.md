# mp3tom4b

> Drag your audio files in. Get an M4B audiobook out. Your files never leave your browser.

A free, browser-based tool that converts MP3, M4A, WAV, FLAC, OGG, and Opus files into M4B audiobook files with chapters and embedded cover art. All conversion happens client-side via WebAssembly — nothing is uploaded to any server.

🌐 **Live:** [mp3tom4b.com](https://mp3tom4b.com)

## What makes this different

Other web converters (CloudConvert, Vertopal, Movavi, etc.) upload your files to their servers. mp3tom4b doesn't — the entire conversion runs inside your browser via ffmpeg.wasm. The repo is open source so you can verify that for yourself.

## Features

- Drag-and-drop multi-file input — drop audio files and a cover image together, or a whole folder.
- Each file becomes a chapter, in your chosen order, with editable titles.
- Auto-fill of audiobook metadata from embedded tags, plus optional online lookup via iTunes / Open Library (only metadata leaves the browser, only on explicit click).
- Embedded cover art (JPG / PNG / WebP), auto-resized to 1200×1200.
- Bitrate options from 64 kbps (audiobook standard) up to 256 kbps, with a smart default and live output-size estimate.
- Estimated time remaining during conversion.
- Five SEO sister pages (`/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`, `/opus-to-m4b`).
- Light + dark theming that follows your OS preference.
- 100% client-side — files never leave your browser.
- Free, no sign-up, no ads, no upload size limits.

See [FEATURES.md](FEATURES.md) for the full list.

_See also: [CHANGELOG.md](CHANGELOG.md), [BACKLOG.md](BACKLOG.md)._

## Tech Stack

- Next.js 14 + TypeScript + Tailwind CSS
- ffmpeg.wasm for in-browser audio encoding
- Hosted on Vercel

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires Node 20+.

## License

MIT (see LICENSE).

## Author

Built by [Burcevski ICT](https://burcevski.nl) in Amersfoort, the Netherlands.
