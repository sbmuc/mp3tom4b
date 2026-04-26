# M4B Forge — Backlog

Ideas explicitly deferred from V1. Don't expand scope into these without a deliberate decision.

## Near-term (V1.1 / V1.2)

- Vitest test suite for `lib/` functions
- Inline chapter title editing UX polish
- Estimated time remaining during conversion
- Custom output filename input field
- Better error messages with specific failure modes
- Keyboard support for drag-to-reorder
- Sister SEO landing pages: `/flac-to-m4b`, `/wav-to-m4b`, `/m4a-to-m4b`, `/ogg-to-m4b`

## Mid-term (V2)

- Browser-storage project save/resume (IndexedDB, no account needed)
- Reverse conversion: M4B → individual MP3 files
- Per-chapter cover art support
- Custom chapter timestamps within a single file
- Dutch UI translation
- German UI translation
- "Continue from where you left off" recovery if browser crashes mid-conversion

## Long-term (V3+)

- iOS app (SwiftUI + AVFoundation), one-time purchase
- M4B chapter editor (edit chapters in existing M4B files without re-encoding)
- M4B metadata fixer (batch tag cleanup for audiobook libraries)
- M4B splitter (split long M4B into chapter-MP3 files)
- Server-side fallback for very large files (only if user demand justifies infra cost)

## Won't Do

- User accounts (no need for this kind of tool)
- Cloud storage / sync (defeats the privacy promise)
- Ads (free forever, monetization via optional iOS app or donations only)
- AI-generated chapter titles (overkill, filename-based is fine)
- Voice cloning / TTS narration (different product entirely)
