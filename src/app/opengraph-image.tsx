import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'mp3tom4b: convert MP3 to M4B in your browser, nothing uploaded'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 180,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          <span style={{ color: '#f4f4f5' }}>mp3to</span>
          <span style={{ color: '#06b6d4' }}>m4b</span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 44,
            color: '#d4d4d8',
            textAlign: 'center',
            lineHeight: 1.25,
          }}
        >
          Convert MP3 to M4B audiobooks in your browser.
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 36,
            color: '#06b6d4',
            fontWeight: 600,
          }}
        >
          Nothing uploaded.
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            fontSize: 24,
            color: '#71717a',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          mp3tom4b.com
        </div>
      </div>
    ),
    { ...size },
  )
}
