import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const buttonIndex = body?.untrustedData?.buttonIndex || 1;

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://basetc.vercel.app";
    let image = "img/logo.png";
    let buttonText = "Go to App";
    let targetUrl = `${BASE_URL}/launch`; // Arahkan ke UI React

    // Logika berdasarkan tombol yang ditekan
    if (buttonIndex === 1) {
      image = "img/basic.png"; // Gambar untuk Monitoring
      buttonText = "Go to Monitoring";
      targetUrl = `${BASE_URL}/launch?tab=monitoring`;
    } else if (buttonIndex === 2) {
      image = "img/pro.png"; // Gambar untuk Rakit
      buttonText = "Go to Rakit";
      targetUrl = `${BASE_URL}/launch?tab=rakit`;
    } else if (buttonIndex === 3) {
      image = "img/legend.png"; // Gambar untuk Market
      buttonText = "Go to Market";
      targetUrl = `${BASE_URL}/launch?tab=market`;
    } else if (buttonIndex === 4) {
      image = "img/supreme.png"; // Gambar untuk Profil
      buttonText = "Go to Profil";
      targetUrl = `${BASE_URL}/launch?tab=profil`;
    }

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta property="og:title" content="BaseTC Miner" />
      <meta property="og:image" content="${BASE_URL}/${image}" />
      <meta property="fc:frame" content="vNext" />
      <meta property="fc:frame:image" content="${BASE_URL}/${image}" />
      <meta property="fc:frame:button:1" content="${buttonText}" />
      <meta property="fc:frame:button:1:action" content="link" />
      <meta property="fc:frame:button:1:target" content="${targetUrl}" />
      <meta property="fc:frame:button:2" content="Back to Start" />
      <meta property="fc:frame:button:2:action" content="post" />
      <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/actions" />
    </head>
    <body></body>
    </html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error handling frame action:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
