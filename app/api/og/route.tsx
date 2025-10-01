// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";          // OG di Edge
export const contentType = "image/png"; // header benar

// --- helpers ---
function shortAddr(ref?: string | null) {
  if (!ref) return "—";
  const s = String(ref);
  return s.startsWith("0x") && s.length >= 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s.slice(0, 18);
}

// Deterministic hue dari string
function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ref   = (searchParams.get("ref")   || "").trim();
  const name  = (searchParams.get("name")  || "Miner").trim().slice(0, 40);
  const epoch = (searchParams.get("epoch") || "").trim().slice(0, 16);
  const score = (searchParams.get("score") || "").trim().slice(0, 16);

  const hue = hashHue(ref || "basetc");
  // Warna solid yang aman (tanpa gradient)
  const bg  = `hsl(${hue} 72% 16%)`;   // background utama
  const chip = `hsl(${hue} 90% 60%)`;  // aksen

  const width = 1200;
  const height = 800;

  // Baris meta opsional
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
          backgroundColor: bg, // <-- solid color only (aman)
          color: "#e5e7eb",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        {/* Header sederhana */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.1)",
              color: chip,
              fontSize: 36,
              fontWeight: 900,
              marginRight: 18,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 0.2 }}>
              BaseTC Console
            </div>
            <div style={{ fontSize: 22, opacity: 0.9 }}>
              Free Basic rig • Start mining onchain
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div
              style={{
                fontSize: 18,
                padding: "8px 14px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.18)",
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
                letterSpacing: -0.5,
              }}
            >
              {name}
            </div>
            <div style={{ marginTop: 16, fontSize: 30, opacity: 0.92 }}>
              Simple mining • Clear ROI targets • Gas-efficient
            </div>
            {metaText ? (
              <div style={{ marginTop: 18, fontSize: 24, opacity: 0.92 }}>
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
              backgroundColor: chip,
              color: "#0b0f1a",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            Start mining now
          </div>
          <div style={{ fontSize: 20, opacity: 0.92 }}>basetc.vercel.app</div>
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

