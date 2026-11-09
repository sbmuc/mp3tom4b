// Running out of memory, in each browser engine's words: the wasm memory
// trap (measured in V8 and JavaScriptCore; SpiderMonkey's from its message
// list), a failed allocation, or ffmpeg's own ENOMEM line (see run.ts).
// Safari's "Out of bounds memory access" used to go unrecognised.
const OUT_OF_MEMORY_PATTERN = new RegExp(
  [
    'memory access out of bounds', // Chrome, Edge, Opera (V8)
    'out of bounds memory access', // Safari (JavaScriptCore)
    'RuntimeError: index out of bounds', // Firefox (SpiderMonkey)
    'out of memory', // all engines, and ffmpeg
    'allocation failed', // V8: "Array buffer allocation failed"
    'allocation size overflow', // SpiderMonkey
    'could not allocate memory', // V8: WebAssembly.Memory
    'Cannot allocate memory', // ffmpeg: ENOMEM
    'invalid (typed )?array( buffer)? length', // a buffer too big to make
    'failed to grow', // SpiderMonkey: wasm memory
    'Aborted\\(OOM\\)',
  ].join('|'),
  'i',
)

// A wasm trap or abort that isn't memory: the engine stopped mid-run.
const TRAP_PATTERN = /Aborted\(|RuntimeError: unreachable|Unreachable code should not be executed|unreachable executed/i
// The engine's call stack ran out (V8, JavaScriptCore / SpiderMonkey).
const STACK_PATTERN = /Maximum call stack size exceeded|too much recursion/i
// Most of the input couldn't be decoded (run.ts, ffmpeg's exit code 69).
const DAMAGED_PATTERN = /couldn't decode most of the input/i

// The browser couldn't read back a Blob (Chrome: "NotReadableError … could
// not be read"). Seen joining about 3.8 GB of encoded chapters, which the browser
// could no longer hold; reading a source file it means the file moved.
const NOT_READABLE_PATTERN = /NotReadableError|could not be read, typically due to permission problems/i
// Steps that read the encoded parts kept in the page, not the user's files.
const PART_STEP_PATTERN = /^(joining chapters|reading encoded output of)\b/i

export const DAMAGED_OR_PROTECTED =
  "most of this file couldn't be decoded. It may be damaged, or protected with DRM (like books bought from Audible), which no converter can open. Try another copy of the file."

export const ENGINE_STACK =
  'The converter hit an internal limit on this file. Refresh the page and try again; if it keeps happening, please let me know which browser you use.'

export const TOO_BIG_FOR_BROWSER =
  "This audiobook is too big for your browser to put together. Pick a lower bitrate, or convert the book in two parts."

export const OUT_OF_MEMORY =
  'Your browser ran out of memory. Close other tabs and try again; a lower bitrate or a shorter audiobook needs less memory.'

/**
 * Map a raw error from ffmpeg.wasm into a user-readable label.
 * ffmpeg.wasm throws numbers (POSIX codes), bare strings, or Error objects
 * with cryptic wasm messages — none of which mean anything to end users.
 */
export function humanizeFfmpegError(err: unknown): string {
  const raw = extractMessage(err)

  // Memory exhaustion — by far the most common failure on large audiobooks.
  // What it takes is about twice the finished file, so the bitrate and length
  // matter; the number of files doesn't.
  if (OUT_OF_MEMORY_PATTERN.test(raw)) {
    return OUT_OF_MEMORY
  }

  if (NOT_READABLE_PATTERN.test(raw)) {
    if (PART_STEP_PATTERN.test(raw)) return TOO_BIG_FOR_BROWSER
    return capitalize(`${chapterPrefix(raw)}the file couldn't be read any more. Was it moved, renamed or deleted while converting? Keep the files where they are until it's done.`)
  }

  if (DAMAGED_PATTERN.test(raw)) return capitalize(`${chapterPrefix(raw)}${DAMAGED_OR_PROTECTED}`)

  if (STACK_PATTERN.test(raw)) return ENGINE_STACK

  // Wasm aborted (instance terminated mid-execution — often a cancel).
  if (TRAP_PATTERN.test(raw)) {
    return 'Conversion was interrupted. Refresh the page and try again.'
  }

  // POSIX-style error codes thrown as plain numbers by ffmpeg.wasm.
  if (typeof err === 'number') {
    if (err === 28) return OUT_OF_MEMORY
    if (err === 1) return "Couldn't read one of the input files. It may be corrupt or in an unsupported codec."
    return `Conversion failed with code ${err}.`
  }

  // Tagged errors from convert.ts already carry "<step> chapter X/Y: <reason>" —
  // preserve them, just strip the wasm-y bits.
  if (raw && raw.length > 0 && raw !== '[object Object]') return raw

  return 'Conversion failed. Refresh the page and try again.'
}

/** What kind of failure an error is, for anonymous counts (no message, no names). */
export type FailureReason =
  | 'out_of_memory'
  | 'interrupted'
  | 'unreadable_input'
  | 'ffmpeg_exit'
  | 'file_system'
  | 'engine_stopped'
  | 'browser_storage'
  | 'source_moved'
  | 'damaged_input'
  | 'stack_overflow'
  | 'other'

export function failureReason(err: unknown): FailureReason {
  const raw = extractMessage(err)
  if (err === 28 || OUT_OF_MEMORY_PATTERN.test(raw)) return 'out_of_memory'
  if (NOT_READABLE_PATTERN.test(raw)) return PART_STEP_PATTERN.test(raw) ? 'browser_storage' : 'source_moved'
  if (DAMAGED_PATTERN.test(raw)) return 'damaged_input'
  if (STACK_PATTERN.test(raw)) return 'stack_overflow'
  if (TRAP_PATTERN.test(raw)) return 'interrupted'
  if (err === 1 || /invalid data|could ?n[o']t read|corrupt|unsupported codec/i.test(raw)) return 'unreadable_input'
  // A step's ffmpeg run failed for a reason other than memory (run.ts).
  if (/ffmpeg exited with code/i.test(raw)) return 'ffmpeg_exit'
  // ffmpeg.wasm's own "not loaded" / "terminate()" errors: the engine was gone.
  if (/ffmpeg is not loaded|called FFmpeg\.terminate|failed to import ffmpeg-core/i.test(raw)) return 'engine_stopped'
  // Emscripten's file system ("FS error"): typically an output that was never written.
  if (/FS error|ErrnoError/i.test(raw)) return 'file_system'
  return 'other'
}

// Error class names sent as they are: a fixed list, so nothing the user typed
// or a file was called can get through. Not plain "Error": every tagged
// failure is wrapped in one, so it says nothing.
const ERROR_CLASSES = new Set([
  'RangeError', 'TypeError', 'RuntimeError', 'InternalError', 'SyntaxError', 'ReferenceError',
  'DOMException', 'NotReadableError', 'NotFoundError', 'NotAllowedError', 'SecurityError', 'AbortError',
  'QuotaExceededError', 'DataCloneError', 'InvalidStateError', 'EncodingError', 'FFmpegExitError',
])

/** "encoding chapter 3/10: " or "joining chapters: ", the converter's step prefix. */
function chapterPrefix(raw: string): string {
  return /^[^:]*chapter \d+\/\d+: /i.exec(raw)?.[0] ?? ''
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The error's class ("RangeError", "RuntimeError", …) when it is one from the
 * list, read from the "<Class>: message" text the ffmpeg worker sends, or from
 * the Error itself.
 */
function errorClass(err: unknown, raw: string): string | undefined {
  const rest = raw.replace(/^[^:]*chapter \d+\/\d+: |^joining chapters: /i, '')
  const named = /^([A-Za-z]+): /.exec(rest)?.[1]
  if (named && ERROR_CLASSES.has(named)) return named
  if (err instanceof Error && ERROR_CLASSES.has(err.name)) return err.name
  return undefined
}

/**
 * Name-free details of a failure, sent with its reason: ffmpeg's exit code,
 * the converter's step ("encoding chapter 3/10: …" → "encoding") and the
 * error's class from a fixed list. Never the message itself, which can
 * contain chapter or file names.
 */
export function failureDetails(err: unknown): Record<string, string | number> {
  const raw = extractMessage(err)
  const details: Record<string, string | number> = {}
  const cls = errorClass(err, raw)
  if (cls) details.errorClass = cls
  const code = /exit(?:ed with)? code (-?\d+)/i.exec(raw)?.[1]
  if (code !== undefined) details.exitCode = Number(code)
  else if (typeof err === 'number') details.exitCode = err
  const step = /^(reading encoded output of|reading|encoding|joining chapters)\b/i.exec(raw)?.[1]
  if (step) details.step = step === 'reading encoded output of' ? 'reading_output' : step.replace(' ', '_')
  return details
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'number') return `error code ${err}`
  if (err == null) return ''
  return String(err)
}
