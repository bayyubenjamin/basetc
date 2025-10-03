// supabase/functions/calculate-nft-usage-points/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http } from "https://esm.sh/viem";
import { baseSepolia } from "https://esm.sh/viem/chains";
import gameCoreABI from "../_shared/gameCoreABI.json" assert { type: "json" };

const GAMECORE_ADDRESS = "0x87Eac0Fbf5e656457bF52ec29c607BB955a58836";
const RPC_URL = Deno.env.get("RPC_URL")!;

// Poin per rig yang digunakan
const POINTS_PER_BASIC = 1;
const POINTS_PER_PRO = 5;
const POINTS_PER_LEGEND = 25;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Dapatkan ronde leaderboard yang sedang aktif
    const { data: activeRound, error: roundError } = await supabase
      .from("leaderboard_rounds")
      .select("id")
      .eq("status", "active")
      .single();

    if (roundError || !activeRound) {
      throw new Error("No active leaderboard round found.");
    }
    const round_id = activeRound.id;

    // 2. Dapatkan semua pengguna yang memiliki wallet
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("fid, wallet")
      .not("wallet", "is", null);

    if (userError) throw userError;

    const pointsToInsert = [];

    for (const user of users) {
      if (!user.wallet) continue;

      // Cek apakah user sedang mining
      const miningActive = (await publicClient.readContract({
          address: GAMECORE_ADDRESS,
          abi: gameCoreABI,
          functionName: "miningActive",
          args: [user.wallet],
      })) as boolean;

      if (!miningActive) continue;

      const usage = (await publicClient.readContract({
        address: GAMECORE_ADDRESS,
        abi: gameCoreABI,
        functionName: "miningUsage",
        args: [user.wallet],
      })) as bigint[];

      const bUsed = Number(usage[1]);
      const pUsed = Number(usage[4]);
      const lUsed = Number(usage[7]);

      const totalPoints =
        bUsed * POINTS_PER_BASIC +
        pUsed * POINTS_PER_PRO +
        lUsed * POINTS_PER_LEGEND;

      if (totalPoints > 0) {
        pointsToInsert.push({
          fid: user.fid,
          points: totalPoints,
          source: "NFT_USAGE",
          round_id: round_id,
          description: `Daily usage: ${bUsed}B/${pUsed}P/${lUsed}L`,
        });
      }
    }

    // 3. Masukkan semua poin dalam satu batch
    if (pointsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("leaderboard_points")
        .insert(pointsToInsert);
      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ ok: true, points_added: pointsToInsert.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "UNKNOWN_ERROR" }), { status: 500 });
  }
});
