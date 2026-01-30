// app/api/frame/rank/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rank = searchParams.get("rank") || "-";
  const points = searchParams.get("points") || "0";
  const username = searchParams.get("username") || "Miner";
  
  // URL host saat ini
  const HOST = process.env.NEXT_PUBLIC_BASE_URL || "basetc.vercel.app";
  
  // Link ke Image Generator yang baru kita buat
  const imageUrl = `${HOST}/api/og/rank?rank=${rank}&points=${points}&username=${encodeURIComponent(username)}`;
  
  // Link kalau frame diklik
  const targetUrl = `${HOST}/launch?tab=monitoring`;

  const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta property="og:title" content="My BaseTC Rank" />
      <meta property="og:image" content="${imageUrl}" />
      
      <meta property="fc:frame" content="vNext" />
      <meta property="fc:frame:image" content="${imageUrl}" />
      <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
      
      <meta property="fc:frame:button:1" content="🚀 Join Mining" />
      <meta property="fc:frame:button:1:action" content="link" />
      <meta property="fc:frame:button:1:target" content="${targetUrl}" />
      
      <meta property="fc:frame:button:2" content="Check My Rank" />
      <meta property="fc:frame:button:2:action" content="link" />
      <meta property="fc:frame:button:2:target" content="${targetUrl}" />
    </head>
    <body>
        <h1>Rank #${rank} on BaseTC</h1>
    </body>
    </html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
