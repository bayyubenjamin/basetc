// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const { fid } = await req.json();
    if (!fid) {
      return new Response(JSON.stringify({ error: "FID_REQUIRED" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("EDGE_SUPABASE_URL")!,
      Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE")!
    );

    const { data, error } = await supabase.rpc("fn_claim_basic_from_referral", { p_fid: fid });
    if (error) throw error;

    return new Response(JSON.stringify({ claimed: data ?? 0 }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "UNKNOWN_ERROR" }), { status: 500 });
  }
});
