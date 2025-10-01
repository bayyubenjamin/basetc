// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";            // jalankan di Edge
export const contentType = "image/png";   // biar header benar
export const alt = "BaseTC Share Card";   // optional

export async function GET() {
  // Versi super-minimal buat sanity check
  const width = 1200;   // 3:2 = 1200x800
  const height = 800;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb", // biru solid
          color: "#ffffff",
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI",
        }}
      >
        BaseTC
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

