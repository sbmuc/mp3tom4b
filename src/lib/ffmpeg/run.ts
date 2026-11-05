import type { FFmpeg } from '@ffmpeg/ffmpeg'

/** Why ffmpeg failed, as far as its log tells. */
export type ExitCause = 'out_of_memory' | 'unreadable_input' | 'unknown'

const MESSAGES: Record<ExitCause, (code: number) => string> = {
  out_of_memory: (code) => `ffmpeg ran out of memory (exit code ${code})`,
  unreadable_input: (code) => `ffmpeg couldn't read the input (exit code ${code})`,
  unknown: (code) => `ffmpeg exited with code ${code}`,
}

/** ffmpeg exited with an error code. */
export class FFmpegExitError extends Error {
  constructor(
    readonly code: number,
    readonly kind: ExitCause,
  ) {
    super(MESSAGES[kind](code))
    this.name = 'FFmpegExitError'
  }
}

// What ffmpeg logs when an allocation fails: with memory growth enabled the
// wasm heap doesn't abort, malloc returns NULL and ffmpeg says so in its own
// words, e.g. "Out of memory" when the 2 GB heap is full, or "Error
// allocating the encoding context." (both seen in tests/integration/
// outOfMemory.test.ts).
const OUT_OF_MEMORY_LOG = /Cannot allocate memory|Out of memory|ENOMEM|Error allocating|Failed to allocate|Could not allocate/i
// What it logs for input it can't make sense of: a damaged or cut-off file.
const UNREADABLE_LOG = /Invalid data found when processing input|moov atom not found|could not find codec parameters/i

/**
 * Run a step that must succeed, and throw when ffmpeg fails, instead of
 * carrying on and tripping over its missing or cut-off output a step later
 * (an unexplained "FS error"). The log is only scanned here, for the line
 * that says why; it never leaves this function, because it can contain the
 * input's tags.
 */
export async function runFFmpeg(ffmpeg: FFmpeg, args: string[]): Promise<void> {
  let kind: ExitCause = 'unknown'
  const onLog = ({ message }: { message: string }) => {
    if (OUT_OF_MEMORY_LOG.test(message)) kind = 'out_of_memory'
    else if (kind === 'unknown' && UNREADABLE_LOG.test(message)) kind = 'unreadable_input'
  }
  ffmpeg.on('log', onLog)
  try {
    const code = await ffmpeg.exec(args)
    if (code !== 0) throw new FFmpegExitError(code, kind)
  } finally {
    ffmpeg.off('log', onLog)
  }
}
