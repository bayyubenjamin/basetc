// app/api/leaderboard/route.ts
export const runtime = 'nodejs';
// PENTING: Konfigurasi ini memaksa Next.js untuk tidak menyimpan cache (SSR/ISR off)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabase/server';

export async function GET() {
  try {
    // Select semua kolom dari view
    const { data, error } = await supabaseAdmin
      .from('leaderboard_view')
      .select('*')
      // Pastikan diurutkan berdasarkan poin tertinggi
      .order('total_points', { ascending: false }) 
      .limit(100);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mengembalikan JSON dengan header Cache-Control yang ketat
    return NextResponse.json(
      { items: data },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );

  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Internal Server Error' }, { status: 500 });
  }
}
