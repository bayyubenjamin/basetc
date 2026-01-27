import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(req: Request) {
  try {
    const { fid } = await req.json();

    if (!fid) {
      return NextResponse.json({ error: "Missing FID" }, { status: 400 });
    }

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { error } = await supabase.functions.invoke("add-spin-points", {
        body: { fid },
      });
      
      if (error) {
        console.error("Supabase invoke error:", error);
        throw new Error(error.message);
      }
      
      return NextResponse.json({ ok: true });
    } else {
        return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
  }
}
