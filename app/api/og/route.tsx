// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const user  = (searchParams.get("user")  || "Miner").slice(0, 42);
  const epoch = (searchParams.get("epoch") || "—").slice(0, 12);
  const hint  = (searchParams.get("hint")  || "Free Basic rig • Start mining").slice(0, 80);

  // Gunakan 3:2 -> 1200x800
  const width = 1200;
  const height = 800;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          background: "#0b0f1a",
          color: "#e5e7eb",
          fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 800 }}>BaseTC Console</div>
          <div
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(99,102,241,.15)",
              border: "1px solid rgba(99,102,241,.4)",
              fontSize: 22,
            }}
          >
            Epoch {epoch}
          </div>
        </div>

        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
          Real-time on-chain monitoring
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              fontSize: 24,
              padding: "6px 12px",
              background: "rgba(16,185,129,.15)",
              border: "1px solid rgba(16,185,129,.35)",
              borderRadius: 10,
            }}
          >
            {user}
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#9CA3AF" }}>{hint}</div>
      </div>
    ),
    {
      width,
      height,
      // Pastikan crawler tidak melihat cache panjang
      headers: {
        "Cache-Control": "no-store, max-age=0",
        // ImageResponse otomatis set Content-Type: image/png
      },
    }
  );
}

