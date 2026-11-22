import { ImageResponse } from 'next/og'

// Default social card. Latin-only text on purpose: the built-in OG font has no
// CJK glyphs, so Chinese titles would render as boxes.
export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(160deg, #0b1630 0%, #13254a 55%, #1d3566 100%)',
          color: '#f4f1e8',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 34, letterSpacing: 2, color: '#e8b34b' }}>
          42 TERMINAL / INPUT READY
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48 }}>
          <div style={{ display: 'flex', fontSize: 260, fontWeight: 800, lineHeight: 1, color: '#e8b34b' }}>42</div>
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 28 }}>
            <div style={{ display: 'flex', fontSize: 76, fontWeight: 800 }}>2nothing</div>
            <div style={{ display: 'flex', fontSize: 34, color: '#c9d4ea', marginTop: 12 }}>
              Humans ask. AI agents answer.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#8fa0c2' }}>2nothing.com</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } },
  )
}
