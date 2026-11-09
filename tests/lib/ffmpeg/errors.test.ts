import { describe, expect, it } from 'vitest'
import { ENGINE_STACK, OUT_OF_MEMORY, TOO_BIG_FOR_BROWSER, failureDetails, failureReason, humanizeFfmpegError } from '@/lib/ffmpeg/errors'

describe('humanizeFfmpegError', () => {
  it('explains running out of memory, however the browser reports it', () => {
    expect(humanizeFfmpegError(new RangeError('Array buffer allocation failed'))).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError(new Error('encoding chapter 3/20: RuntimeError: memory access out of bounds'))).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError('Aborted(OOM). Out of memory')).toBe(OUT_OF_MEMORY)
    expect(humanizeFfmpegError(28)).toBe(OUT_OF_MEMORY)
  })

  it('keeps the chapter and step of other failures', () => {
    expect(humanizeFfmpegError(new Error('reading chapter 2/5: file not found'))).toBe('reading chapter 2/5: file not found')
  })

  it('turns an interrupted run into a refresh hint', () => {
    expect(humanizeFfmpegError(new Error('RuntimeError: unreachable'))).toMatch(/interrupted/)
  })
})

describe('failureReason', () => {
  it('sorts failures into anonymous kinds', () => {
    expect(failureReason(new Error('RuntimeError: memory access out of bounds'))).toBe('out_of_memory')
    expect(failureReason(new RangeError('Array buffer allocation failed'))).toBe('out_of_memory')
    expect(failureReason(28)).toBe('out_of_memory')
    expect(failureReason(new Error('Aborted()'))).toBe('interrupted')
    expect(failureReason(1)).toBe('unreadable_input')
    expect(failureReason(new Error('chapter 3/10: Invalid data found when processing input'))).toBe('unreadable_input')
    expect(failureReason(new Error('something else'))).toBe('other')
  })
})

describe('failures from ffmpeg runs', () => {
  it('counts an ffmpeg allocation failure as out of memory and says so', () => {
    const err = new Error('joining chapters: ffmpeg ran out of memory (exit code 1)')
    expect(failureReason(err)).toBe('out_of_memory')
    expect(humanizeFfmpegError(err)).toBe(OUT_OF_MEMORY)
    expect(failureReason(new Error('Aborted(OOM). Build with -sASSERTIONS for more info.'))).toBe('out_of_memory')
  })

  it('tells exit codes, a stopped engine and file-system errors apart', () => {
    expect(failureReason(new Error('encoding chapter 2/5: ffmpeg exited with code 1'))).toBe('ffmpeg_exit')
    expect(failureReason(new Error('ffmpeg is not loaded, call `await ffmpeg.load()` first'))).toBe('engine_stopped')
    expect(failureReason(new Error('called FFmpeg.terminate()'))).toBe('engine_stopped')
    expect(failureReason(new Error('reading encoded output of chapter 1/1: FS error'))).toBe('file_system')
    expect(failureReason(new Error("encoding chapter 1/3: ffmpeg couldn't read the input (exit code 1)"))).toBe('unreadable_input')
  })
})

describe('failureDetails', () => {
  it('sends the exit code and step, never the message', () => {
    expect(failureDetails(new Error('encoding chapter 2/5: ffmpeg exited with code 1'))).toEqual({ exitCode: 1, step: 'encoding' })
    expect(failureDetails(new Error('reading encoded output of chapter 1/1: FS error'))).toEqual({ step: 'reading_output' })
    expect(failureDetails(new Error('joining chapters: ffmpeg ran out of memory (exit code 1)'))).toEqual({ exitCode: 1, step: 'joining_chapters' })
    expect(failureDetails(234)).toEqual({ exitCode: 234 })
    expect(failureDetails(new Error('Something about "My Book - Chapter 1.mp3"'))).toEqual({})
  })
})

describe('a Blob the browser can no longer read', () => {
  const chrome = "NotReadableError: Failed to execute 'readAsArrayBuffer' on 'FileReaderSync': The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired."

  it('joining the encoded chapters: the book is too big for the browser', () => {
    // Seen after 56 minutes, joining about 3.8 GB of encoded chapters in Chrome.
    const err = new Error(`joining chapters: ${chrome}`)
    expect(humanizeFfmpegError(err)).toBe(TOO_BIG_FOR_BROWSER)
    expect(failureReason(err)).toBe('browser_storage')
  })

  it('reading a source file: it was moved or deleted', () => {
    const err = new Error(`reading chapter 3/10: ${chrome}`)
    expect(humanizeFfmpegError(err)).toMatch(/^Reading chapter 3\/10: the file couldn't be read any more\. Was it moved/)
    expect(failureReason(err)).toBe('source_moved')
  })
})

describe('every browser engine, in its own words', () => {
  // As the ffmpeg worker sends them ("<Class>: message"). Chrome's and Safari's
  // measured (V8 in Node, JavaScriptCore with macOS's jsc); Firefox's from
  // SpiderMonkey's ErrorNumbers.msg.
  const outOfMemory = [
    'RuntimeError: memory access out of bounds', // Chrome, Edge, Opera
    'RuntimeError: Out of bounds memory access', // Safari
    'RuntimeError: index out of bounds', // Firefox
    'RangeError: Out of memory', // Safari, huge ArrayBuffer
    'InternalError: out of memory', // Firefox
    'InternalError: allocation size overflow', // Firefox
    'RangeError: invalid array length', // Firefox
    'RangeError: Invalid typed array length: 4294967296', // Chrome
    'RangeError: failed to grow memory', // Firefox
    'RangeError: WebAssembly.Memory(): could not allocate memory', // Chrome
  ]
  it.each(outOfMemory)('%s is out of memory, with the advice', (text) => {
    const err = new Error(`encoding chapter 2/26: ${text}`)
    expect(failureReason(err)).toBe('out_of_memory')
    expect(humanizeFfmpegError(err)).toBe(OUT_OF_MEMORY)
  })

  it.each([
    'RuntimeError: unreachable', // Chrome
    'RuntimeError: Unreachable code should not be executed', // Safari
    'RuntimeError: unreachable executed', // Firefox
    'RuntimeError: Aborted(native code called abort())', // emscripten
  ])('%s is an interrupted run', (text) => {
    expect(failureReason(new Error(`encoding chapter 1/1: ${text}`))).toBe('interrupted')
  })

  it.each(['RangeError: Maximum call stack size exceeded', 'InternalError: too much recursion'])('%s is a stack overflow', (text) => {
    const err = new Error(`encoding chapter 1/3: ${text}`)
    expect(failureReason(err)).toBe('stack_overflow')
    expect(humanizeFfmpegError(err)).toBe(ENGINE_STACK)
  })
})

describe('a file that is mostly undecodable', () => {
  it('says it may be damaged or protected with DRM', () => {
    // M4B to MP3, after 17 minutes: ffmpeg's exit code 69 (run.ts).
    const split = new Error("ffmpeg couldn't decode most of the input (exit code 69)")
    expect(failureReason(split)).toBe('damaged_input')
    expect(humanizeFfmpegError(split)).toMatch(/^Most of this file couldn't be decoded\. It may be damaged, or protected with DRM/)
    // The converter keeps which chapter.
    const convert = new Error("encoding chapter 4/12: ffmpeg couldn't decode most of the input (exit code 69)")
    expect(humanizeFfmpegError(convert)).toMatch(/^Encoding chapter 4\/12: most of this file couldn't be decoded/)
    expect(failureDetails(convert)).toEqual({ exitCode: 69, step: 'encoding' })
  })
})

describe('the error class, from a fixed list', () => {
  it('is sent when the message names one', () => {
    expect(failureDetails(new Error('encoding chapter 1/3: RangeError: Out of memory'))).toEqual({ errorClass: 'RangeError', step: 'encoding' })
    expect(failureDetails('RuntimeError: unreachable')).toEqual({ errorClass: 'RuntimeError' })
    expect(failureDetails(new Error('joining chapters: NotReadableError: Failed to execute'))).toMatchObject({ errorClass: 'NotReadableError', step: 'joining_chapters' })
  })

  it("is the Error's own name when the text names none", () => {
    expect(failureDetails(new TypeError('x is undefined'))).toEqual({ errorClass: 'TypeError' })
  })

  it('never passes on anything else', () => {
    // A chapter called "Secret: the end" must not become a class.
    expect(failureDetails(new Error('encoding chapter 1/3: Secret: the end'))).toEqual({ step: 'encoding' })
    expect(failureDetails('Anna Writer: something broke')).toEqual({})
  })
})
