// app/api/leaderboard/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../lib/supabase/server';

export async function GET() {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('referral_events')
      .select('referrer_fid, count:count(*)')
      .eq('status', 'mined')
      .not('referrer_fid', 'is', null)
      .gte('created_at', since)
      .group('referrer_fid')
      .order('count', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'leaderboard_error' }, { status: 400 });
  }
}

