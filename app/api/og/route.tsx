/* app/api/og/route.tsx */
import { ImageResponse } from "next/og";

export const runtime = "edge";               // lebih cepat untuk scrape
export const alt = "BaseTC Share Card";
export const contentType = "image/png";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Ambil param opsional
    const name = (searchParams.get("name") || "Miner").slice(0, 40);
    const fid  = searchParams.get("fid") || "";
    const ref  = searchParams.get("ref") || "";
    const epoch = searchParams.get("epoch") || "";

    // >> PENTING: ukuran 3:2 sesuai spesifikasi Mini Apps
    const width = 1500;
    const height = 1000;

    const png = new ImageResponse(
      (
        <div
          style={{
            width: `${width}px`,
            height: `${height}px`,
            display: "flex",
            flexDirection: "column",
            background: "#0b0f1a",
            color: "#e5e7eb",
            padding: "56px",
            justifyContent: "space-between",
            fontFamily: "sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div
              style={{
                width: 72,
                height: 72,
                background: "#1e293b",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#93c5fd",
                fontSize: 42,
                fontWeight: 800,
              }}
            >
              B
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 28, opacity: 0.7 }}>BaseTC Console</div>
              <div style={{ fontSize: 40, fontWeight: 700 }}>
                Free Basic rig • Start mining
              </div>
            </div>
          </div>

          {/* Stripe tengah */}
          <div
            style={{
              flexGrow: 1,
              marginTop: 28,
              marginBottom: 28,
              background:
                "linear-gradient(90deg, rgba(59,130,246,0.2), rgba(255,255,255,0.6), rgba(59,130,246,0.2))",
              borderRadius: 24,
            }}
          />

          {/* Footer info dinamis */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 28, opacity: 0.7 }}>Invited by</div>
              <div style={{ fontSize: 44, fontWeight: 800 }}>
                {name}
                {fid ? ` · fid:${fid}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, opacity: 0.7 }}>Referral</div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  maxWidth: 680,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ref || "basetc.vercel.app"}
              </div>
              {epoch ? (
                <div style={{ fontSize: 24, opacity: 0.7, marginTop: 6 }}>
                  Epoch: {epoch}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ),
      {
        width,
        height,
        // >> PENTING: header caching supaya tidak abu-abu di feed
        headers: {
          "Cache-Control": "public, immutable, no-transform, max-age=300",
        },
      }
    );

    return png;
  } catch (e) {
    // Fallback sederhana jika ada error render
    return new ImageResponse(
      (
        <div
          style={{
            width: "1500px",
            height: "1000px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b0f1a",
            color: "white",
            fontSize: 48,
          }}
        >
          BaseTC
        </div>
      ),
      {
        width: 1500,
        height: 1000,
        headers: {
          "Cache-Control": "public, no-store",
        },
      }
    );
  }
}

