import { NextResponse } from "next/server";

export async function GET() {
  const img = "https://your-domain.com/img/basic.png";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:title" content="BaseTC Miner" />
<meta property="og:image" content="${img}" />
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="${img}" />
<meta property="fc:frame:button:1" content="Mint Basic" />
<meta property="fc:frame:button:1:action" content="post" />
<meta property="fc:frame:button:2" content="Rakit" />
<meta property="fc:frame:button:2:action" content="post" />
<meta property="fc:frame:button:3" content="Market" />
<meta property="fc:frame:button:3:action" content="post" />
<meta property="fc:frame:post_url" content="https://your-domain.com/api/frame/actions" />
</head>
<body></body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
