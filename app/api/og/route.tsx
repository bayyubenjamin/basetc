// app/api/og/rank/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rank = searchParams.get("rank") || "-";
  const points = searchParams.get("points") || "0";
  const username = searchParams.get("username") || "Miner";

  // Konversi poin biar rapi (koma)
  const fmtPoints = Number(points).toLocaleString("en-US");

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a", // Dark background
          backgroundImage: "radial-gradient(circle at 50% 10%, #1e293b 0%, #0f172a 100%)",
          fontFamily: "sans-serif",
          color: "white",
          position: "relative",
        }}
      >
        {/* Border Glow Effect */}
        <div style={{
            position: 'absolute',
            inset: '20px',
            border: '2px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '24px',
            display: 'flex',
        }} />

        {/* Logo / Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
           <span style={{ fontSize: 32, fontWeight: 900, color: '#60a5fa' }}>BaseTC</span>
           <span style={{ fontSize: 32, fontWeight: 300, marginLeft: 8, color: '#94a3b8' }}>Console</span>
        </div>

        {/* Rank Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: "20px 60px",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
          }}
        >
          <span style={{ fontSize: 24, color: "#94a3b8", marginBottom: 5 }}>CURRENT RANK</span>
          <span style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, color: "#fcd34d", textShadow: "0 0 20px rgba(252, 211, 77, 0.5)" }}>
            #{rank}
          </span>
          <span style={{ fontSize: 32, fontWeight: 700, marginTop: 10, color: "white" }}>
            {username}
          </span>
        </div>

        {/* Footer Stats */}
        <div style={{ display: 'flex', marginTop: '40px', gap: '40px' }}>
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 18, color: '#64748b' }}>TOTAL POINTS</span>
                <span style={{ fontSize: 36, fontWeight: 700 }}>{fmtPoints}</span>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 18, color: '#64748b' }}>NETWORK</span>
                <span style={{ fontSize: 36, fontWeight: 700, color: '#3b82f6' }}>BASE</span>
             </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
