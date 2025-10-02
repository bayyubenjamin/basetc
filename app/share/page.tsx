// app/share/page.tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic' // OG meta dihitung per request

type Props = { searchParams?: Record<string, string | string[] | undefined> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = Object.fromEntries(
    Object.entries(searchParams || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? '')])
  )

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://basetc.xyz'
  const title = 'BaseTC Console — simple mining, clear ROI targets'
  const description = 'Claim a free Basic rig and start mining on BaseTC Console.'

  const ogUrl = new URL('/api/og', baseUrl)
  if (sp.name)  ogUrl.searchParams.set('name', sp.name as string)
  if (sp.fid)   ogUrl.searchParams.set('fid', sp.fid as string)
  if (sp.epoch) ogUrl.searchParams.set('epoch', sp.epoch as string)
  ogUrl.searchParams.set('hint', 'Free Basic rig • Start mining')

  return {
    title,
    description,
    openGraph: { title, description, url: baseUrl, images: [{ url: ogUrl.toString(), width: 1200, height: 630, alt: 'BaseTC Console' }] },
    twitter:   { card: 'summary_large_image', title, description, images: [ogUrl.toString()] },
  }
}

export default function Page({ searchParams }: Props) {
  // Bot tinggal di sini (biar baca OG); manusia diarahkan ke /launch
  const ua = (headers().get('user-agent') || '').toLowerCase()
  const isBot = /bot|crawl|spider|facebookexternalhit|twitterbot|farcaster/.test(ua)

  if (!isBot) {
    const sp = new URLSearchParams()
    const ref = searchParams?.ref; if (typeof ref === 'string') sp.set('ref', ref)
    const fid = searchParams?.fid; if (typeof fid === 'string') sp.set('fid', fid)
    redirect('/launch' + (sp.toString() ? `?${sp.toString()}` : ''))
  }

  return (
    <main style={{ padding: 24, color: '#e5e7eb', background: '#0b0f1a' }}>
      <h1>BaseTC Console</h1>
      <p>Preview for crawlers.</p>
    </main>
  )
}

