export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || "Miner").slice(0, 40);
  const ref  = (searchParams.get("ref")  || "basetc.vercel.app").slice(0, 64);

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
          background: "#0b0f1a",
          color: "#e5e7eb",
          padding: 48,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 12,
              background: "#111827", color: "#60a5fa",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>BaseTC Console</div>
        </div>

        <div style={{ fontSize: 54, fontWeight: 900 }}>Free Basic rig • Start mining</div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{name}</div>
          <div style={{ fontSize: 26, opacity: 0.8, maxWidth: 580, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ref}
          </div>
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

