// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const { fid, tier, action } = await req.json(); // action: "OUTAGE" | "REPAIR"
    if (!fid || !tier || !action) {
      return new Response(JSON.stringify({ error: "MISSING_PARAMS" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("EDGE_SUPABASE_URL")!,
      Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE")!
    );

    const { error } = await supabase.from("outages").insert({
      fid,
      tier: String(tier).toUpperCase(),
      type: String(action).toUpperCase(),
      cost_basetc: 0
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "UNKNOWN_ERROR" }), { status: 500 });
  }
});
