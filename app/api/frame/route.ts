import { NextResponse } from "next/server";

/**
 * Webhook handler untuk Frame.
 * - Farcaster/Infra akan ngirim POST ke endpoint ini
 * - Balasan minimal harus 200 OK biar dianggap valid
 * - Bisa dipakai juga buat validasi signature / logging event user
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // 🔎 Contoh log event (opsional, hapus kalau nggak mau)
    console.log("Webhook hit /api/frame:", body);

    // TODO:
    // - kalau mau, lo bisa verifikasi signature (pakai Neynar SDK)
    // - bisa juga simpan event ke DB (Supabase dsb)

    // ✅ wajib balas 200
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error /api/frame:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * (Opsional) GET untuk health check
 * Bisa dipanggil manual buat cek endpoint hidup
 */
export async function GET() {
  return NextResponse.json({ status: "frame webhook alive" });
}

