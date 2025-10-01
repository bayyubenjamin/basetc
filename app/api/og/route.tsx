import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Stabil hue 0..360 per address (buat warna personal) */
function hueFrom(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export async function GET(req: NextRequest) {
  const { searchParams: sp } = new URL(req.url);

  // Data dinamis (dipangkas biar aman dari overflow)
  const name  = (sp.get("name")  || "Miner").slice(0, 24);
  const ref   = (sp.get("ref")   || "").toLowerCase();
  const epoch = (sp.get("epoch") || "")?.slice(0, 12);

  const shortRef =
    ref && ref.startsWith("0x") && ref.length >= 10
      ? `${ref.slice(0, 6)}…${ref.slice(-4)}`
      : "";

  const hue = ref ? hueFrom(ref) : 210; // default biru

  const width = 1200;
  const height = 630;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          boxSizing: "border-box",
          background: `linear-gradient(180deg, hsl(${hue} 65% 18%) 0%, hsl(${hue} 65% 14%) 100%)`,
          color: "white",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "rgba(255,255,255,.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
            }}
          >
            ⛏️
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 44, fontWeight: 800 }}>BaseTC Console</div>
            <div style={{ fontSize: 22, opacity: 0.85 }}>
              Simple mining • clear ROI targets
            </div>
          </div>
        </div>

        {/* Middle card */}
        <div
          style={{
            flex: 1,
            marginTop: 40,
            marginBottom: 40,
            borderRadius: 24,
            background: "rgba(0,0,0,.30)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "42px 54px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 28, opacity: 0.85 }}>Shared by</div>
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                lineHeight: 1.1,
                wordBreak: "break-word",
                maxWidth: 760,
              }}
            >
              {name}
            </div>
            {shortRef && (
              <div style={{ fontSize: 24, opacity: 0.9 }}>
                Address: {shortRef}
              </div>
            )}
            {epoch && (
              <div style={{ fontSize: 24, opacity: 0.9 }}>Epoch {epoch}</div>
            )}
          </div>

          <div
            style={{
              padding: "20px 28px",
              borderRadius: 16,
              background: "rgba(255,255,255,.16)",
              fontSize: 28,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Free Basic Rig
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            opacity: 0.92,
          }}
        >
          <div>basetc.vercel.app</div>
          <div>Start mining on Base</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // biar crawler recrawl cepat; tombol share kamu sudah kasih ?v=...
        "Cache-Control": "public, max-age=0, s-maxage=60",
      },
    }
  );
}

