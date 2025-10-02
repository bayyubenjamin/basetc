// app/api/og/route.tsx
import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Hash sederhana → hue 0..360 untuk warna stabil per user */
function hueFrom(seed: string) {
  if (!seed) return 210; // fallback biru
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Potong address jadi 0x1234…cdef */
function shortHex(addr: string) {
  const a = (addr || "").toLowerCase();
  if (a.startsWith("0x") && a.length >= 12) return `${a.slice(0, 6)}…${a.slice(-4)}`;
  return a.slice(0, 12);
}

/** Batasi panjang string biar layout aman */
function clamp(text: string, max = 40) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // ---- Params dinamis dari URL ----
  const name  = clamp(searchParams.get("name")  || "Miner", 32);
  const ref   = (searchParams.get("ref")        || "").trim();
  const fid   = (searchParams.get("fid")        || "").trim();     // angka/string
  const epoch = clamp(searchParams.get("epoch") || "", 12);

  // Seed warna: prioritaskan ref → fid → name
  const seed = ref || fid || name;
  const hue = hueFrom(seed);

  const width = 1200;
  const height = 630;

  // --- UI constants ---
  const bg = `linear-gradient(
    135deg,
    hsl(${hue} 70% 18%) 0%,
    hsl(${(hue + 25) % 360} 70% 22%) 45%,
    hsl(${(hue + 55) % 360} 70% 18%) 100%
  )`;

  const cardBg = "rgba(255,255,255,.08)";
  const soft = "rgba(255,255,255,.12)";

  const title = "BaseTC Invite";
  const subtitle = "Start mining • Free Basic rig";

  // Elemen OG (tidak pakai font eksternal → aman di Edge)
  const element = (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        padding: 56,
        background: bg,
        color: "#fff",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 20,
            background: soft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: 0.5,
          }}
        >
          BT
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 0.2 }}>{title}</div>
          <div style={{ fontSize: 22, opacity: 0.9 }}>{subtitle}</div>
        </div>
      </div>

      {/* Middle card */}
      <div
        style={{
          flex: 1,
          marginTop: 34,
          marginBottom: 34,
          borderRadius: 28,
          background: cardBg,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-between",
          padding: 40,
          gap: 28,
        }}
      >
        {/* Kiri: data user */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div style={{ fontSize: 28, opacity: 0.9 }}>Shared by</div>
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1.05 }}>{name}</div>

          {ref ? (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 12,
                fontSize: 28,
                opacity: 0.92,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: soft,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                REF
              </span>
              <span>{shortHex(ref)}</span>
            </div>
          ) : null}

          {fid ? (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 12,
                fontSize: 28,
                opacity: 0.92,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: soft,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                FID
              </span>
              <span>{fid}</span>
            </div>
          ) : null}

          {epoch ? (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 12,
                fontSize: 28,
                opacity: 0.92,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: soft,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                EPOCH
              </span>
              <span>{epoch}</span>
            </div>
          ) : null}
        </div>

        {/* Kanan: badge */}
        <div
          style={{
            alignSelf: "center",
            padding: "22px 28px",
            borderRadius: 18,
            background: "rgba(0,0,0,.22)",
            border: "1px solid rgba(255,255,255,.18)",
            fontSize: 30,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#22c55e",
              boxShadow: "0 0 16px rgba(34,197,94,.65)",
            }}
          />
          Free Basic rig
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.95 }}>
        <div style={{ fontSize: 26 }}>basetc.vercel.app</div>
        <div style={{ fontSize: 26 }}>Mine on Base • Onchain</div>
      </div>
    </div>
  );

  const img = new ImageResponse(element, { width, height });

  // Cache tipis (crawler akan respect), & kamu sudah tambahkan `&v=...` saat share
  img.headers.set("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=86400");

  return img;
}

