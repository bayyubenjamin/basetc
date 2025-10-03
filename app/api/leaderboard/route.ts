// app/api/leaderboard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabase/server';

export async function GET() {
  try {
    // Query langsung ke view yang sudah kita buat
    const { data, error } = await supabaseAdmin
      .from('leaderboard_view') // <-- Menggunakan VIEW, bukan tabel
      .select('*')
      .limit(100); // Ambil 100 teratas

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'leaderboard_error' }, { status: 400 });
  }
}
