// How browsers, the wasm runtime and ffmpeg itself report running out:
// a trap, a failed ArrayBuffer, or ffmpeg's ENOMEM line (see run.ts).
const OUT_OF_MEMORY_PATTERN = /memory access out of bounds|out of memory|allocation failed|Cannot allocate memory|Aborted\(OOM\)/i

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

  // Wasm aborted (instance terminated mid-execution — often a cancel).
  if (/Aborted\(\)|RuntimeError: unreachable/i.test(raw)) {
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
  | 'other'

export function failureReason(err: unknown): FailureReason {
  const raw = extractMessage(err)
  if (err === 28 || OUT_OF_MEMORY_PATTERN.test(raw)) return 'out_of_memory'
  if (/Aborted\(\)|RuntimeError: unreachable/i.test(raw)) return 'interrupted'
  if (err === 1 || /invalid data|could ?n[o']t read|corrupt|unsupported codec/i.test(raw)) return 'unreadable_input'
  // A step's ffmpeg run failed for a reason other than memory (run.ts).
  if (/ffmpeg exited with code/i.test(raw)) return 'ffmpeg_exit'
  // ffmpeg.wasm's own "not loaded" / "terminate()" errors: the engine was gone.
  if (/ffmpeg is not loaded|called FFmpeg\.terminate|failed to import ffmpeg-core/i.test(raw)) return 'engine_stopped'
  // Emscripten's file system ("FS error"): typically an output that was never written.
  if (/FS error|ErrnoError/i.test(raw)) return 'file_system'
  return 'other'
}

/**
 * Name-free details of a failure, sent with its reason: ffmpeg's exit code and
 * the converter's step ("encoding chapter 3/10: …" → "encoding"). Never the
 * message itself, which can contain chapter or file names.
 */
export function failureDetails(err: unknown): Record<string, string | number> {
  const raw = extractMessage(err)
  const details: Record<string, string | number> = {}
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
