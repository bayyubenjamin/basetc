import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json(); // { userFid, referrerFid, action, tx }
    console.log("[referral]", body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

