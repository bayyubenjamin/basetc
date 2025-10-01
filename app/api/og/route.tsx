// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";   // HARUS edge
export const revalidate = 0;

export async function GET(req: Request) {
  // ambil param opsional (nggak wajib)
  const { searchParams } = new URL(req.url);
  const user = (searchParams.get("user") || "Miner").slice(0, 42);
  const epoch = (searchParams.get("epoch") || "—").slice(0, 12);

  // Rasio 3:2 → 1200x800 (recommended)
  const width = 1200;
  const height = 800;

  // Versi paling minimal & kontras tinggi
  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 60,
          // background gelap biar kontras
          background: "#0b0f1a",
          color: "#e5e7eb",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -0.5 }}>BaseTC Console</div>
          <div
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "#4f46e5", // ungu solid biar kelihatan
              color: "#fff",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            Epoch {epoch}
          </div>
        </div>

        {/* Body highlight (blok ungu biar pasti terlihat) */}
        <div
          style={{
            background: "rgba(99,102,241,0.2)",
            border: "2px solid rgba(99,102,241,0.8)",
            borderRadius: 24,
            padding: 40,
          }}
        >
          <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.05 }}>
            Real-time on-chain monitoring
          </div>
          <div style={{ marginTop: 14, fontSize: 28, opacity: 0.9 }}>
            Start mining with a free Basic rig.
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
          <div style={{ fontSize: 22, color: "#9ca3af" }}>basetc.vercel.app</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // pastikan crawler nggak dapat cache lama
        "Cache-Control": "no-store, max-age=0",
        // Content-Type otomatis diset ke image/png oleh ImageResponse
      },
    }
  );
}

