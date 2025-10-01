// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge"; // penting untuk OG Image

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = (searchParams.get("name") || "Miner").slice(0, 24);
    const refRaw = searchParams.get("ref") || "0x0000000000000000";
    const refShort =
      refRaw.startsWith("0x") && refRaw.length >= 10
        ? `${refRaw.slice(0, 6)}…${refRaw.slice(-4)}`
        : refRaw.slice(0, 12);

    // Warna deterministik dari ref supaya “dinamis”
    const hash =
      [...refRaw].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381) % 360;
    const bg = `hsl(${hash} 70% 18%)`;
    const stripe = `hsl(${(hash + 20) % 360} 70% 52%)`;

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px",
            background: bg,
            color: "#fff",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: stripe,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 800,
              }}
            >
              B
            </div>
            <div style={{ fontSize: 40, fontWeight: 700 }}>BaseTC Console</div>
          </div>

          {/* Middle */}
          <div>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
              Hello, {name}
            </div>
            <div style={{ marginTop: 8, fontSize: 28, opacity: 0.9 }}>
              Start mining with a free Basic rig
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 26, opacity: 0.9 }}>ref: {refShort}</div>
            <div
              style={{
                padding: "14px 24px",
                borderRadius: 14,
                background: "#111827",
                border: "1px solid rgba(255,255,255,.22)",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              basetc.vercel.app
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err: any) {
    // ← Biar nggak blank: kasih error yang kebaca
    return new Response(
      JSON.stringify({
        ok: false,
        where: "/api/og",
        error: String(err?.message || err),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}

