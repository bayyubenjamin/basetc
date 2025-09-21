import { NextResponse } from "next/server";

export async function POST() {
  const img = "https://your-domain.com/img/pro.png";
  const html = `<!DOCTYPE html>
<html>
<head>
<meta property="og:title" content="BaseTC Miner" />
<meta property="og:image" content="${img}" />
<meta property="fc:frame" content="vNext" />
<meta property="fc:frame:image" content="${img}" />
<meta property="fc:frame:button:1" content="Back" />
<meta property="fc:frame:button:1:action" content="post" />
<meta property="fc:frame:post_url" content="https://your-domain.com/api/frame" />
</head>
<body></body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
