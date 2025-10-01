/* app/api/og/route.tsx */
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "Miner";
  const ref = searchParams.get("ref")?.slice(0, 6) || "0x0000";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg,#0260ed,#1e3a8a)",
          color: "white",
          fontSize: 64,
          fontWeight: "bold",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 20 }}>⚡ BaseTC</div>
        <div>Hello, {name}</div>
        <div style={{ fontSize: 28, marginTop: 10 }}>Ref: {ref}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

