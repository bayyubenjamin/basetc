// app/api/ratelimit/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/server';

type Body = { fid: number; action: string; limit?: number };

export async function POST(req: Request) {
  try {
    const { fid, action, limit = 5 } = (await req.json()) as Body;
    if (!fid || !action) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);

    // baca counter
    const { data, error } = await supabaseAdmin
      .from('rate_limits')
      .select('count')
      .eq('fid', fid)
      .eq('day', today)
      .eq('action', action)
      .maybeSingle();

    if (error) throw error;

    const count = data?.count ?? 0;
    if (count >= limit) {
      return NextResponse.json({ allowed: false, remaining: 0 }, { status: 429 });
    }

    // bump 1
    const { error: err2 } = await supabaseAdmin.rpc('bump_rate_limit', { p_fid: fid, p_action: action });
    if (err2) throw err2;

    return NextResponse.json({ allowed: true, remaining: Math.max(0, limit - (count + 1)) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'ratelimit_error' }, { status: 400 });
  }
}

