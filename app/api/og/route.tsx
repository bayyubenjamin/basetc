// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";

// Palet HEX aman (tanpa transparansi/gradient)
const PALETTE = [
  "#0ea5e9", // sky
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#e11d48", // rose
  "#10b981", // emerald
  "#3b82f6", // blue
];

function shortAddr(ref?: string | null) {
  if (!ref) return "—";
  const s = String(ref);
  return s.startsWith("0x") && s.length >= 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s.slice(0, 18);
}

// Hash simpel → index palet
function hashIndex(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref   = (searchParams.get("ref")   || "").trim();
  const name  = (searchParams.get("name")  || "Miner").trim().slice(0, 40);
  const epoch = (searchParams.get("epoch") || "").trim().slice(0, 16);
  const score = (searchParams.get("score") || "").trim().slice(0, 16);

  // Pilih warna solid dari palet, fallback ke biru
  const color = PALETTE[hashIndex(ref || "basetc")] || "#2563eb";

  const width = 1200;
  const height = 800;

  const metaBits: string[] = [];
  if (epoch) metaBits.push(`Epoch ${epoch}`);
  if (score) metaBits.push(`Score ${score}`);
  const metaText = metaBits.join(" • ");

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          padding: 56,
          // HANYA warna solid HEX
          backgroundColor: color,
          color: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111111", // solid
              color: "#ffffff",
              fontSize: 36,
              fontWeight: 900,
              marginRight: 18,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>
              BaseTC Console
            </div>
            <div style={{ fontSize: 22 }}>
              Free Basic rig • Start mining onchain
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div
              style={{
                fontSize: 18,
                padding: "8px 14px",
                borderRadius: 999,
                // semua solid, tidak pakai rgba
                backgroundColor: "#ffffff",
                color: "#111111",
                fontWeight: 700,
              }}
            >
              {shortAddr(ref)}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            <div style={{ marginTop: 16, fontSize: 30 }}>
              Simple mining • Clear ROI targets • Gas-efficient
            </div>
            {metaText ? (
              <div style={{ marginTop: 18, fontSize: 24 }}>
                {metaText}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              backgroundColor: "#111111",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            Start mining now
          </div>
          <div style={{ fontSize: 20 }}>basetc.vercel.app</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, immutable, no-transform, max-age=300",
      },
    }
  );
}

