// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";            // Fast & compatible for OG
export const contentType = "image/png";

// --- helpers ---
function shortAddr(ref?: string | null) {
  if (!ref) return "—";
  const s = String(ref);
  return s.startsWith("0x") && s.length >= 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s.slice(0, 18);
}

// Simple deterministic hash → 0..360 for HSL hue
function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h % 360;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Params (dengan fallback aman)
  const ref   = (searchParams.get("ref")   || "").trim();
  const name  = (searchParams.get("name")  || "Miner").trim().slice(0, 40);
  const epoch = (searchParams.get("epoch") || "").trim().slice(0, 16);
  const score = (searchParams.get("score") || "").trim().slice(0, 16);

  // Warna dinamis dari ref (kalau kosong, pakai seed default)
  const hue = hashHue(ref || "basetc");
  const bg1 = `hsl(${hue} 72% 14%)`;   // dark tone
  const bg2 = `hsl(${hue} 82% 20%)`;   // lighter tone
  const pill = `hsl(${hue} 90% 60%)`;  // accent for badges

  const width = 1200;
  const height = 800;

  // Garis dekoratif (stripe) semi-transparan
  const stripe =
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 10px, transparent 10px, transparent 20px)";

  // Subtext / meta line (epoch/score kalau ada)
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
          background: `linear-gradient(180deg, ${bg1}, ${bg2})`,
          color: "#e5e7eb",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        {/* background subtle texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: stripe,
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.35)",
              color: pill,
              fontSize: 36,
              fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 0.2 }}>
              BaseTC Console
            </div>
            <div style={{ fontSize: 22, opacity: 0.85 }}>
              Free Basic rig • Start mining onchain
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                fontSize: 18,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {shortAddr(ref)}
            </div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", paddingTop: 12 }}>
          <div style={{ maxWidth: 980 }}>
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
            <div
              style={{
                marginTop: 16,
                fontSize: 30,
                opacity: 0.9,
              }}
            >
              Simple mining • Clear ROI targets • Gas-efficient
            </div>

            {metaText ? (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 24,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {metaText}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              background: pill,
              color: "#0b0f1a",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            Start mining now
          </div>
          <div
            style={{
              fontSize: 20,
              opacity: 0.9,
            }}
          >
            basetc.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // cukup pendek biar gampang re-scrape; /share/[addr]?v=... tetap menang
        "Cache-Control": "public, immutable, no-transform, max-age=300",
      },
    }
  );
}

