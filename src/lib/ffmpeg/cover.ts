/**
 * Output options that encode the cover input as the book's JPEG cover.
 *
 * `-huffman default`: the JPEG encoder in our ffmpeg-core (ffmpeg 5.1) builds
 * optimal Huffman tables by default, and on many real covers that overruns its
 * output buffer ("put_bits buffer too small"). The run then fails, dies with
 * "memory access out of bounds" (shown as running out of memory), or never
 * finishes. The standard tables don't have the bug and cost a few percent in
 * file size.
 */
export const COVER_CODEC_ARGS = ['-c:v', 'mjpeg', '-huffman', 'default']
