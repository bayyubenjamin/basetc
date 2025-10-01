import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 64,
          background: "blue",
          color: "white",
        }}
      >
        TEST BASETC
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

