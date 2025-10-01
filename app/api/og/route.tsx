/* app/api/og/route.tsx */
import { ImageResponse } from "next/og";

// Dynamic OG endpoint
export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const user = searchParams.get("user") || "Miner";
  const epoch = searchParams.get("epoch") || "Epoch 1";
  const hint = searchParams.get("hint") || "Free Basic rig • Start mining";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0b0f1a",
          color: "#e5e7eb",
          fontSize: 48,
          fontWeight: "bold",
          padding: "40px",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: "20px", color: "#60a5fa" }}>
          BaseTC Console
        </div>
        <div>{hint}</div>
        <div style={{ fontSize: 36, marginTop: "40px", opacity: 0.8 }}>
          {user} — {epoch}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

