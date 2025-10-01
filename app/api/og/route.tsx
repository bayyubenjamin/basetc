import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

export const runtime = "edge";

// Simple hash → hue 0..360 untuk warna solid yang konsisten per address
function hueFrom(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export async function GET(req: NextRequest) {
  const { searchParams: sp } = new URL(req.url);

  const name  = (sp.get("name")  || "Miner").slice(0, 32);
  const ref   = (sp.get("ref")   || "").toLowerCase();
  const epoch = (sp.get("epoch") || "")?.slice(0, 12);

  const shortRef =
    ref && ref.startsWith("0x") && ref.length >= 10
      ? `${ref.slice(0, 6)}…${ref.slice(-4)}`
      : ref.slice(0, 12);

  // warna latar stabil per address, fallback kalau kosong → 210 (biru)
  const hue = ref ? hueFrom(ref) : 210;

  // OPTIONAL: muat font system (biar aman tanpa fetch)
  // (ImageResponse default pakai sans-serif; cukup untuk performa & kompatibilitas)

  const width = 1200;
  const height = 630;

  const res = new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          boxSizing: "border-box",
          background: `hsl(${hue} 70% 16%)`,
          color: "white",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* pakai emoji sebagai “logo” agar tidak perlu fetch gambar eksternal */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "rgba(255,255,255,.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
            }}
          >
            ⛏️
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 0.2 }}>
              BaseTC Console
            </div>
            <div style={{ fontSize: 22, opacity: 0.8 }}>
              Simple mining • clear ROI targets
            </div>
          </div>
        </div>

        {/* Middle card */}
        <div
          style={{
            flex: 1,
            marginTop: 32,
            marginBottom: 32,
            borderRadius: 28,
            background: "rgba(0,0,0,.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 32, opacity: 0.85 }}>Shared by</div>
            <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05 }}>
              {name}
            </div>
            {shortRef ? (
              <div style={{ fontSize: 26, opacity: 0.85 }}>Address: {shortRef}</div>
            ) : null}
            {epoch ? (
              <div style={{ fontSize: 26, opacity: 0.85 }}>Epoch: {epoch}</div>
            ) : null}
          </div>

          {/* Badge */}
          <div
            style={{
              padding: "18px 28px",
              borderRadius: 16,
              background: "rgba(255,255,255,.12)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Free Basic rig
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: 0.9,
          }}
        >
          <div style={{ fontSize: 26 }}>basetc.vercel.app</div>
          <div style={{ fontSize: 26 }}>Start mining on Base</div>
        </div>
      </div>
    ),
    { width, height }
  );

  // Cache tipis (crawler Warpcast suka nge-cache lama). Kamu juga
  // sudah kasih parameter `?v=` di URL dari tombol share.
  res.headers.set("Cache-Control", "public, max-age=0, s-maxage=60");

  return res;
}

