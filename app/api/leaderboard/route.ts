// app/api/leaderboard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabase/server';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('view_leaderboard_realtime') // <-- Nama View dari langkah 1
      .select('*')
      .limit(100); // Ambil Top 100

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
