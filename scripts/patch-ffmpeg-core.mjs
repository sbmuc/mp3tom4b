// Writes public/ffmpeg/0.12.6-p2/ffmpeg-core.js: the stock ffmpeg-core.js with
// two fixes.
//
// 1. exec() keeps working on the same instance. It calls ffmpeg's main, which
//    ends every run by throwing an "Aborted" exception out of wasm. That skips
//    the code that would move the wasm stack pointer back, so each run leaves
//    its stack frames behind. After ~65 MP3 encodes (fewer or more depending on
//    the command) the stack runs into the heap and the next run dies with
//    "RuntimeError: memory access out of bounds", even though almost no memory
//    is in use. Saving the stack pointer before the call and restoring it after
//    fixes that.
//
// 2. WORKERFS reads ahead. The tools mount their inputs instead of copying them
//    in (src/lib/ffmpeg/files.ts). WORKERFS fetches every read ffmpeg makes with
//    its own FileReaderSync call, and ffmpeg reads 32 KB at a time, so a 233 MB
//    stream-copy took 7,000 calls and ~2-4x as long as a copy in memory. Reading
//    1 MB at a time and serving the next reads from it makes it faster than
//    copying the file in first.
//
// The wasm is untouched and stays at /ffmpeg/0.12.6/; only the JS gets a new
// path, because /ffmpeg/* is cached as immutable (0.12.6-p1 had fix 1 only and
// stays for pages still running an older build). Run after upgrading the core:
//   node scripts/patch-ffmpeg-core.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public/ffmpeg/0.12.6/ffmpeg-core.js')
const outDir = path.join(root, 'public/ffmpeg/0.12.6-p2')

const PATCHES = [
  {
    what: 'exec()',
    stock:
      'function exec(..._args){const args=[...Module["DEFAULT_ARGS"],..._args];try{Module["_ffmpeg"](args.length,stringsToPtr(args))}catch(e){if(!e.message.startsWith("Aborted")){throw e}}return Module["ret"]}',
    patched:
      'function exec(..._args){const args=[...Module["DEFAULT_ARGS"],..._args];const sp=stackSave();try{Module["_ffmpeg"](args.length,stringsToPtr(args))}catch(e){if(!e.message.startsWith("Aborted")){throw e}}finally{stackRestore(sp)}return Module["ret"]}',
  },
  {
    what: 'WORKERFS read',
    stock:
      'read:function(stream,buffer,offset,length,position){if(position>=stream.node.size)return 0;var chunk=stream.node.contents.slice(position,position+length);var ab=WORKERFS.reader.readAsArrayBuffer(chunk);buffer.set(new Uint8Array(ab),offset);return chunk.size}',
    patched:
      'read:function(stream,buffer,offset,length,position){var size=stream.node.size;if(position>=size)return 0;var c=stream.readAhead;if(!c||position<c.start||position+length>c.start+c.data.length){var end=Math.min(size,position+Math.max(length,1048576));c=stream.readAhead={start:position,data:new Uint8Array(WORKERFS.reader.readAsArrayBuffer(stream.node.contents.slice(position,end)))}}var n=Math.min(length,c.start+c.data.length-position);buffer.set(c.data.subarray(position-c.start,position-c.start+n),offset);return n}',
  },
]

let js = readFileSync(src, 'utf8')
for (const p of PATCHES) {
  if (js.split(p.stock).length !== 2) {
    throw new Error(`${p.what} in ${src} isn't the one this patch expects; check the fix still applies to this core version.`)
  }
  js = js.replace(p.stock, p.patched)
}
mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'ffmpeg-core.js'), js)
console.log(`wrote ${path.relative(root, path.join(outDir, 'ffmpeg-core.js'))}`)
