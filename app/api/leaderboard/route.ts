// app/api/leaderboard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabase/server';

type Row = {
  referrer_fid: number | null;
  status: string;
  created_at: string;
};

export async function GET() {
  try {
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // Ambil data mentah lalu agregasi di Node
    const { data, error } = await supabaseAdmin
      .from('referral_events')
      .select('referrer_fid, status, created_at')
      .eq('status', 'mined')
      .not('referrer_fid', 'is', null)
      .gte('created_at', sinceIso);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts = new Map<number, number>();
    (data as Row[] | null)?.forEach((row) => {
      const r = Number(row.referrer_fid);
      if (!Number.isFinite(r)) return;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    });

    // Urutkan desc & ambil top 50
    const items = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([referrer_fid, count]) => ({ referrer_fid, count }));

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'leaderboard_error' }, { status: 400 });
  }
}

