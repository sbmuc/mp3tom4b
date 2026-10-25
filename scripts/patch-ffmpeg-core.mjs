// Writes public/ffmpeg/0.12.6-p1/ffmpeg-core.js: the stock ffmpeg-core.js with
// one fix, so it can keep running commands on the same instance.
//
// The core's exec() calls ffmpeg's main, which ends every run by throwing an
// "Aborted" exception out of wasm. That skips the code that would move the wasm
// stack pointer back, so each run leaves its stack frames behind. After ~65 MP3
// encodes (fewer or more depending on the command) the stack runs into the heap
// and the next run dies with "RuntimeError: memory access out of bounds", even
// though almost no memory is in use. Saving the stack pointer before the call
// and restoring it after fixes that.
//
// The wasm is untouched and stays at /ffmpeg/0.12.6/; only the JS gets a new
// path, because /ffmpeg/* is cached as immutable. Run after upgrading the core:
//   node scripts/patch-ffmpeg-core.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public/ffmpeg/0.12.6/ffmpeg-core.js')
const outDir = path.join(root, 'public/ffmpeg/0.12.6-p1')

const STOCK =
  'function exec(..._args){const args=[...Module["DEFAULT_ARGS"],..._args];try{Module["_ffmpeg"](args.length,stringsToPtr(args))}catch(e){if(!e.message.startsWith("Aborted")){throw e}}return Module["ret"]}'
const PATCHED =
  'function exec(..._args){const args=[...Module["DEFAULT_ARGS"],..._args];const sp=stackSave();try{Module["_ffmpeg"](args.length,stringsToPtr(args))}catch(e){if(!e.message.startsWith("Aborted")){throw e}}finally{stackRestore(sp)}return Module["ret"]}'

const js = readFileSync(src, 'utf8')
if (js.split(STOCK).length !== 2) {
  throw new Error(`exec() in ${src} isn't the one this patch expects; check the fix still applies to this core version.`)
}
mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'ffmpeg-core.js'), js.replace(STOCK, PATCHED))
console.log(`wrote ${path.relative(root, path.join(outDir, 'ffmpeg-core.js'))}`)
