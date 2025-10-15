// app/api/notify-epoch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ==== ENV ====
// GameCore contract (must expose epochNow(): uint256)
const gameCoreAddress = process.env.CONTRACT_GAMECORE as `0x${string}` | undefined;

// Supabase server-side (SERVICE ROLE KEY!)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ==== Minimal ABI: only epochNow() ====
const gameCoreABI = [
  {
    type: "function",
    name: "epochNow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ==== Table row type ====
type TokenRow = {
  fid: number;
  token: string;
  url: string;
  last_epoch_notified: number;
  disabled: boolean;
};

// JSON helper
function json(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    if (!gameCoreAddress) return json({ ok: false, error: "Missing env CONTRACT_GAMECORE" }, 500);
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Missing Supabase server env" }, 500);
    }

    // --- query params ---
    const u = new URL(req.url);
    const force =
      u.searchParams.get("force") === "1" ||
      u.searchParams.get("force")?.toLowerCase() === "true";

    // 1) Read current epoch from contract (TS bypass on viem read)
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const epochNowBn = await (publicClient as any).readContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      functionName: "epochNow",
    });
    const currentEpoch = Number(epochNowBn);

    // Optional: overrides via query (fallback to English defaults)
    const defaultTitle = `Epoch ${currentEpoch} started`;
    const defaultBody  = `Claim your daily reward for epoch ${currentEpoch}.`;
    const defaultTarget = "https://basetc.xyz/launch";

    const title = u.searchParams.get("title") || defaultTitle;
    const body = u.searchParams.get("body") || defaultBody;
    const targetUrl = u.searchParams.get("targetUrl") || defaultTarget;

    // 2) Pick tokens needing notifications
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("farcaster_tokens")
      .select("fid, token, url, last_epoch_notified, disabled")
      .eq("disabled", false)
      .lt("last_epoch_notified", currentEpoch);

    if (error) throw error;

    const rows = (data || []) as TokenRow[];
    if (rows.length === 0) {
      return json({ ok: true, epoch: currentEpoch, message: "No users need notification", results: [] });
    }

    // 3) Group by Farcaster notification server URL
    const byUrl: Record<string, TokenRow[]> = {};
    for (const r of rows) (byUrl[r.url] ??= []).push(r);

    // Use unique ID in force mode to avoid idempotency; otherwise idempotent per epoch
    const notificationId = force
      ? `epoch-test-${Date.now()}`
      : `epoch-reminder-${currentEpoch}`;

    const results: Array<{
      url: string;
      sent: number;
      succeeded: number;
      invalid: number;
      rateLimited: number;
      sampleFids?: number[];
    }> = [];

    // 4) Send per URL, batch of 100
    for (const [serverUrl, list] of Object.entries(byUrl)) {
      let succ = 0, inv = 0, rl = 0, sent = 0;

      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const tokens = chunk.map(c => c.token);
        sent += tokens.length;

        const resp = await fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId, title, body, targetUrl, tokens }),
        });

        const jr = await resp.json().catch(() => ({} as any));
        const successfulTokens: string[] = jr.successfulTokens || [];
        const invalidTokens: string[] = jr.invalidTokens || [];
        const rateLimitedTokens: string[] = jr.rateLimitedTokens || [];

        succ += successfulTokens.length;
        inv  += invalidTokens.length;
        rl   += rateLimitedTokens.length;

        // 5) Update DB: on success, mark epoch (skip on force mode to keep QA clean)
        if (!force && successfulTokens.length > 0) {
          const fidsOk = chunk.filter(c => successfulTokens.includes(c.token)).map(c => c.fid);
          if (fidsOk.length > 0) {
            await supabase
              .from("farcaster_tokens")
              .update({ last_epoch_notified: currentEpoch })
              .in("fid", fidsOk);
          }
        }

        // 6) Disable invalid tokens
        if (invalidTokens.length > 0) {
          const fidsBad = chunk.filter(c => invalidTokens.includes(c.token)).map(c => c.fid);
          if (fidsBad.length > 0) {
            await supabase
              .from("farcaster_tokens")
              .update({ disabled: true })
              .in("fid", fidsBad);
          }
        }
      }

      results.push({
        url: serverUrl,
        sent,
        succeeded: succ,
        invalid: inv,
        rateLimited: rl,
        sampleFids: (byUrl[serverUrl] || []).slice(0, 5).map(r => r.fid),
      });
    }

    return json({ ok: true, epoch: currentEpoch, force, title, body, targetUrl, results });
  } catch (e: any) {
    console.error("[notify-epoch] error:", e?.message || e);
    return json({ ok: false, error: e?.message || "notify-epoch-error" }, 500);
  }
}

