// supabase/functions/add-spin-points/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POINTS_FOR_SPIN = 5;

Deno.serve(async (req: Request) => {
  try {
    const { fid } = await req.json();
    if (!fid) {
      return new Response(JSON.stringify({ error: "MISSING_PARAMS" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Dapatkan ronde yang aktif
    const { data: activeRound, error: roundError } = await supabase
        .from("leaderboard_rounds")
        .select("id")
        .eq("status", "active")
        .single();

    if (roundError || !activeRound) {
        return new Response(JSON.stringify({ error: "No active round" }), { status: 400 });
    }

    const { error } = await supabase.from("leaderboard_points").insert({
      fid: fid,
      points: POINTS_FOR_SPIN,
      source: "DAILY_SPIN",
      round_id: activeRound.id,
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "UNKNOWN_ERROR" }), { status: 500 });
  }
});
