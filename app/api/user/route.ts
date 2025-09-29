import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// [FIX 1] Paksa route ini menjadi dinamis.
// Ini sangat penting agar Vercel selalu membaca environment variables
// pada saat runtime, bukan saat build time. Mencegah error "Missing SUPABASE_URL".
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Helper function terpusat untuk membuat koneksi Supabase sebagai admin.
 * Menggunakan service_role key untuk bypass RLS (Row Level Security).
 * @returns SupabaseClient
 */
function getSbAdmin() {
  const url = process.env.SUPABASE_URL;
  // [FIX 2] Standardisasi nama environment variable.
  // Gunakan SUPABASE_SERVICE_ROLE_KEY secara konsisten di seluruh proyek.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Memberikan error yang jelas di log server jika env var tidak ditemukan.
    console.error("Server Error: Missing Supabase admin credentials.");
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  // Opsi { auth: { persistSession: false } } penting untuk lingkungan server.
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Handler GET: Mengambil data pengguna berdasarkan FID atau wallet.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get("fid");
    const wallet = searchParams.get("wallet");

    if (!fid && !wallet) {
      return NextResponse.json({ error: "fid or wallet parameter is required" }, { status: 400 });
    }

    const sb = getSbAdmin();
    let query = sb.from("users").select().limit(1).single();

    if (fid) {
      query = query.eq('fid', fid);
    } else if (wallet) {
      query = query.eq('wallet', String(wallet).toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST116') { // Kode error Supabase jika tidak ada baris yang ditemukan
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);

  } catch (e: any) {
    console.error("GET /api/user Error:", e);
    return NextResponse.json({ error: e.message || "An unexpected error occurred" }, { status: 500 });
  }
}

/**
 * Handler POST: Membuat atau memperbarui (upsert) data pengguna.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const body = await req.json().catch(() => {
      throw new Error("Invalid JSON body");
    });

    // [FIX 3] Validasi dan sanitasi payload yang masuk.
    // Ini mencegah data yang tidak valid atau tidak lengkap masuk ke database.
    const payload: any = {};
    if (body.fid) payload.fid = Number(body.fid);
    if (body.wallet) payload.wallet = String(body.wallet).toLowerCase();
    
    // Hanya perbarui field profil jika nilainya ada (bukan undefined).
    // Ini mencegah data yang ada terhapus oleh nilai null/undefined.
    if (typeof body.username !== 'undefined') payload.username = body.username;
    if (typeof body.display_name !== 'undefined') payload.display_name = body.display_name;
    if (typeof body.pfp_url !== 'undefined') payload.pfp_url = body.pfp_url;
    
    // FID adalah kunci utama, jadi wajib ada.
    if (!payload.fid) {
      return NextResponse.json({ error: "Missing required field: fid" }, { status: 400 });
    }

    // Menggunakan .upsert() adalah cara yang paling efisien dan aman untuk
    // membuat atau memperbarui data dalam satu operasi.
    const { data, error } = await sb
      .from("users")
      .upsert(payload, { onConflict: "fid" }) // Tentukan kolom 'fid' sebagai unique identifier.
      .select()
      .single(); // Kembalikan data yang baru saja di-upsert.

    if (error) throw error; // Biarkan error Supabase ditangkap oleh blok catch.

    return NextResponse.json({ success: true, user: data });

  } catch (e: any) {
    console.error("POST /api/user Error:", e);
    return NextResponse.json({ success: false, error: e.message || "An unexpected server error occurred" }, { status: 500 });
  }
}

