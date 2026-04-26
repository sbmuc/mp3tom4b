# mp3tom4b

> Drag your audio files in. Get an M4B audiobook out. Your files never leave your browser.

A free, browser-based tool that converts MP3, M4A, WAV, FLAC, OGG, and Opus files into M4B audiobook files with chapters and embedded cover art. All conversion happens client-side via WebAssembly — nothing is uploaded to any server.

🌐 **Live:** [mp3tom4b.com](https://mp3tom4b.com)

## What makes this different

Other web converters (CloudConvert, Vertopal, Movavi, etc.) upload your files to their servers. mp3tom4b doesn't — the entire conversion runs inside your browser via ffmpeg.wasm. The repo is open source so you can verify that for yourself.

## Features

- Drag-and-drop multi-file input
- Each file becomes a chapter, in your chosen order
- Editable chapter titles (auto-generated from filenames)
- Embedded cover art (JPG/PNG)
- Full audiobook metadata (title, author, narrator, year, genre)
- 100% client-side — files never leave your browser
- Free, no sign-up, no ads, no upload size limits

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
