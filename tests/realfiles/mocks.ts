// The shipped ffmpeg-core in Node instead of the browser workers (see
// tests/integration/nodeFFmpeg.ts). Loaded as a setup file before every test.
import { vi } from 'vitest'

vi.mock('@/lib/ffmpeg/client', async () => (await import('../integration/nodeFFmpeg')).clientMock)
vi.mock('@ffmpeg/util', () => ({
  fetchFile: async (f: Blob) => new Uint8Array(await f.arrayBuffer()),
}))
