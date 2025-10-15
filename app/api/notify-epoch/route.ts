// app/api/notify-epoch/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Row = { fid: number; token: string; url: string };

async function sendBatch(rows: Row[], targetUrl: string, id: string, title: string, body: string) {
  const url = rows[0]?.url; // sama per client; kalau beda, kelompokkan per url
  const tokens = rows.map(r => r.token).slice(0, 100);
  const res = await fetch(url!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notificationId: id, // contoh: epoch-2025-10-15
      title,
      body,
      targetUrl,
      tokens
    }),
  });
  if (!res.ok) {
    const j = await res.text();
    throw new Error(`send fail: ${j}`);
  }
}

export async function POST() {
  // TODO: ambil dari DB semua rows yang aktif
  const rows: Row[] = []; // <- replace dengan hasil query DB
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const today = new Date().toISOString().slice(0, 10); // UTC
  const id = `epoch-${today}`; // idempotent per hari
  const title = "Epoch baru dimulai!";
  const body = "Buka BaseTC sekarang untuk klaim harianmu 🚀";
  const targetUrl = "https://basetc.xyz/launch?from=notif";

  // Kelompokkan per 'url' (beda klien)
  const byUrl: Record<string, Row[]> = {};
  for (const r of rows) (byUrl[r.url] ??= []).push(r);

  for (const u of Object.keys(byUrl)) {
    const list = byUrl[u];
    for (let i = 0; i < list.length; i += 100) {
      await sendBatch(list.slice(i, i + 100), targetUrl, id, title, body);
    }
  }
  return NextResponse.json({ ok: true, sent: rows.length });
}

