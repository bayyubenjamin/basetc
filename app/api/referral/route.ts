// app/api/referral/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase/server';

type Body = {
  fid: number;
  referrerFid?: number | null;
  action: 'claim' | 'merge_pro' | 'merge_legend' | 'start' | 'stop' | 'boost';
  status?: 'issued' | 'mined' | 'failed';
  txHash?: string | null;
  meta?: Record<string, unknown>;
};

function ipFrom(req: Request) {
  // best effort IP untuk analitik anti-tuyul
  // (jangan dipakai sebagai auth)
  return (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.fid || !body?.action) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const row = {
      fid: body.fid,
      referrer_fid: body.referrerFid ?? null,
      action: body.action,
      status: body.status ?? 'issued',
      tx_hash: body.txHash ?? null,
      meta: { ...(body.meta ?? {}), ip: ipFrom(req) },
    };

    const { error } = await supabaseAdmin.from('referral_events').insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'referral_api_error' }, { status: 400 });
  }
}

