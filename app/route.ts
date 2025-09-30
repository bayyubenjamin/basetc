import { NextResponse } from "next/server";

export async function GET() {
  // Pastikan BASE_URL sesuai dengan domain Vercel Anda
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://basetc.vercel.app";
  const img = `${BASE_URL}/img/basic.png`;

  const html = `<!doctype html><html><head>
<meta property="og:title" content="BaseTC Miner" />
<meta property="og:url" content="${BASE_URL}" />
<meta property="og:image" content="${img}" />
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="${img}" />
<meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/actions" />

<meta property="fc:frame:button:1" content="Monitoring" />
<meta property="fc:frame:button:1:action" content="post" />

<meta property="fc:frame:button:2" content="Rakit" />
<meta property="fc:frame:button:2:action" content="post" />

<meta property="fc:frame:button:3" content="Market" />
<meta property="fc:frame:button:3:action" content="post" />

<meta property="fc:frame:button:4" content="Profil" />
<meta property="fc:frame:button:4:action" content="post" />

</head><body></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
