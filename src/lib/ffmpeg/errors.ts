/**
 * Map a raw error from ffmpeg.wasm into a user-readable label.
 * ffmpeg.wasm throws numbers (POSIX codes), bare strings, or Error objects
 * with cryptic wasm messages — none of which mean anything to end users.
 */
export function humanizeFfmpegError(err: unknown): string {
  const raw = extractMessage(err)

  // Memory exhaustion — by far the most common failure on large audiobooks.
  if (/memory access out of bounds|out of memory|allocation failed/i.test(raw)) {
    return 'Ran out of memory while converting. Try fewer files at once, a shorter audiobook, or a lower bitrate.'
  }

  // Wasm aborted (instance terminated mid-execution — often a cancel).
  if (/Aborted\(\)|RuntimeError: unreachable/i.test(raw)) {
    return 'Conversion was interrupted. Refresh the page and try again.'
  }

  // POSIX-style error codes thrown as plain numbers by ffmpeg.wasm.
  if (typeof err === 'number') {
    if (err === 28) return 'Ran out of memory. Try fewer files or a shorter audiobook.'
    if (err === 1) return "Couldn't read one of the input files. It may be corrupt or in an unsupported codec."
    return `Conversion failed with code ${err}.`
  }

  // Tagged errors from convert.ts already carry "<step> chapter X/Y: <reason>" —
  // preserve them, just strip the wasm-y bits.
  if (raw && raw.length > 0 && raw !== '[object Object]') return raw

  return 'Conversion failed. Refresh the page and try again.'
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'number') return `error code ${err}`
  if (err == null) return ''
  return String(err)
}
