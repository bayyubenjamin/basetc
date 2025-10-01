// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const alt = "BaseTC Share Card";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name  = (searchParams.get("name")  || "Miner").slice(0, 40);
  const fid   = (searchParams.get("fid")   || "").slice(0, 20);
  const ref   = (searchParams.get("ref")   || "basetc.vercel.app").slice(0, 64);
  const epoch = (searchParams.get("epoch") || "").slice(0, 12);

  // 3:2, cukup rendah supaya file size kecil
  const width = 1200;
  const height = 800;

  return new ImageResponse(
    (
      <div
        style={{
          width, height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          background: "#0b0f1a",
          color: "#e5e7eb",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: 14,
              background: "#111827",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#60a5fa", fontSize: 34, fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, opacity: 0.8 }}>BaseTC Console</div>
            <div style={{ fontSize: 36, fontWeight: 800 }}>Free Basic rig • Start mining</div>
          </div>
          {epoch ? (
            <div
              style={{
                marginLeft: "auto",
                padding: "8px 14px",
                borderRadius: 999,
                background: "#4f46e5",
                color: "#fff",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              Epoch {epoch}
            </div>
          ) : null}
        </div>

        {/* Strips sederhana (tanpa gradien) */}
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <div style={{ height: 8, background: "#2563eb", flex: 1, borderRadius: 6 }} />
          <div style={{ height: 8, background: "#10b981", flex: 1, borderRadius: 6 }} />
          <div style={{ height: 8, background: "#f59e0b", flex: 1, borderRadius: 6 }} />
        </div>

        {/* Headline */}
        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.06 }}>
          Real-time on-chain monitoring
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 24, opacity: 0.7 }}>Invited by</div>
            <div style={{ fontSize: 38, fontWeight: 800 }}>
              {name}{fid ? ` · fid:${fid}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, opacity: 0.7 }}>Referral</div>
            <div
              style={{
                fontSize: 28, fontWeight: 700, maxWidth: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {ref}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width, height,
      headers: {
        // Cache ringan & compatible dengan scraper
        "Cache-Control": "public, immutable, no-transform, max-age=300",
      },
    }
  );
}

