// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MERGE_RULES = {
  BASIC_to_PRO: { need: 10 },
  PRO_to_LEGEND: { need: 5 },
  LEGEND_to_SUPREME: { need: 3 }
} as const;

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json();
    const { fid, fromTier, toTier } = body || {};
    if (!fid || !fromTier || !toTier) {
      return new Response(JSON.stringify({ error: "MISSING_PARAMS" }), { status: 400 });
    }

    const key = `${String(fromTier).toUpperCase()}_to_${String(toTier).toUpperCase()}` as keyof typeof MERGE_RULES;
    const rule = MERGE_RULES[key];
    if (!rule) {
      return new Response(JSON.stringify({ error: "INVALID_RULE" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("EDGE_SUPABASE_URL")!,
      Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE")!
    );

    // NOTE: nanti tambahkan call onchain ke GameCore.merge(...) lalu catat tx_hash ke merge_events.
    const { error } = await supabase.rpc("fn_merge_tier", {
      p_fid: fid,
      p_from_tier: fromTier,
      p_need: rule.need,
      p_to_tier: toTier
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "UNKNOWN_ERROR" }), { status: 500 });
  }
});
