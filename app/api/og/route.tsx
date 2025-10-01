// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const user  = (searchParams.get("user")  || "Miner").slice(0, 42);
  const epoch = (searchParams.get("epoch") || "—").slice(0, 12);
  const hint  = (searchParams.get("hint")  || "Free Basic rig • Start mining").slice(0, 80);

  const width = 1200;
  const height = 800; // 3:2

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "#0b0f1a",
          color: "#e5e7eb",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -0.5 }}>BaseTC Console</div>
          <div
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "#4f46e5",
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            Epoch {epoch}
          </div>
        </div>

        {/* Progress strip */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ height: 10, background: "#4f46e5", flex: 1, borderRadius: 6 }} />
          <div style={{ height: 10, background: "#10b981", flex: 1, borderRadius: 6 }} />
          <div style={{ height: 10, background: "#f59e0b", flex: 1, borderRadius: 6 }} />
        </div>

        {/* Headline */}
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
          Real-time on-chain monitoring
        </div>

        {/* Footer: user + hint */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              fontSize: 26,
              padding: "8px 14px",
              borderRadius: 12,
              background: "rgba(16,185,129,.18)",
              border: "1px solid rgba(16,185,129,.5)",
              color: "#d1fae5",
              fontWeight: 700,
            }}
          >
            {user}
          </div>
          <div style={{ fontSize: 22, color: "#9ca3af" }}>{hint}</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

