// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 0; // jangan cache

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user  = (searchParams.get("user")  || "Miner").slice(0, 42);
  const epoch = (searchParams.get("epoch") || "—").slice(0, 12);
  const hint  = (searchParams.get("hint")  || "Free Basic rig • Start mining").slice(0, 80);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          background: "#0b0f1a",
          color: "#e5e7eb",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 800 }}>BaseTC Console</div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(99,102,241,.15)",
              border: "1px solid rgba(99,102,241,.4)",
              fontSize: 20,
            }}
          >
            Epoch {epoch}
          </div>
        </div>

        <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.05 }}>
          Real-time on-chain monitoring
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              fontSize: 22,
              padding: "6px 12px",
              background: "rgba(16,185,129,.15)",
              border: "1px solid rgba(16,185,129,.35)",
              borderRadius: 10,
            }}
          >
            {user}
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#9CA3AF" }}>{hint}</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

