// app/api/og/route.tsx
import { ImageResponse } from 'next/og'   // ⬅️ ganti ini (bukan 'next/server')

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }

export function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const name  = (sp.get('name')  || 'Miner').slice(0, 30)
  const fid   = (sp.get('fid')   || '').slice(0, 12)
  const epoch = (sp.get('epoch') || '—')
  const hint  = sp.get('hint') || 'Free Basic rig • Start mining'

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
        background: '#0b0f1a', color: '#e5e7eb', padding: '48px', justifyContent: 'space-between'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>BaseTC Console</div>
          <div style={{
            padding: '8px 14px', borderRadius: 999, background: 'rgba(99,102,241,.15)',
            border:'1px solid rgba(99,102,241,.4)', fontSize: 20
          }}>
            Epoch {epoch}
          </div>
        </div>

        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05 }}>
          Real-time on-chain monitoring
        </div>

        <div style={{ display:'flex', gap: 12 }}>
          <div style={{
            fontSize: 22, padding: '6px 12px', background:'rgba(16,185,129,.15)',
            border:'1px solid rgba(16,185,129,.35)', borderRadius: 10
          }}>
            {name}{fid ? ` • FID ${fid}` : ''}
          </div>
        </div>

        <div style={{ fontSize: 22, color: '#9CA3AF' }}>
          basetc.vercel.app
        </div>
      </div>
    ),
    { ...size }
  )
}

