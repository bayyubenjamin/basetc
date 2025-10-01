// app/api/og/route.tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 0;

export async function GET() {
  // OG minimal: panel ungu 1200x800 (rasio 3:2)
  const width = 1200;
  const height = 800;

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          background: "#4f46e5", // ungu solid
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* strip dekoratif biar jelas ini gambar besar */}
        <div
          style={{
            width: "70%",
            height: 12,
            background: "rgba(255,255,255,.6)",
            borderRadius: 8,
          }}
        />
      </div>
    ),
    {
      width,
      height,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

