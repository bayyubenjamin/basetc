// app/api/sign-event-action/route.ts
import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { createClient } from "@supabase/supabase-js";
import {
  stakingVaultAddress,
  stakingVaultABI,
  spinVaultAddress,
  spinVaultABI,
  rigSaleABI
} from "../../lib/web3Config";
import { parseEther } from "viem";

export const runtime = "nodejs";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453);
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// --- EIP-712 Domains (must match contracts) ---
const STAKING_VAULT_DOMAIN = {
  name: "StakingVault",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: stakingVaultAddress,
};

const SPIN_VAULT_DOMAIN = {
  name: "SpinVault",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: spinVaultAddress,
};

// --- Types ---
const STAKING_TYPES = {
  StakeAction: [
    { name: "user", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "lockType", type: "uint8" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  HarvestAction: [
    { name: "user", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
  UnstakeAction: [
    { name: "user", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const SPIN_TYPES = {
  Spin: [
    { name: "user", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// Helper untuk menghitung total invite dari Supabase
async function countAllInvites(inviter: string) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase ENV not configured for referral check');
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { count, error } = await sb
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('inviter', inviter.toLowerCase());
    if (error) throw new Error(`Failed to count all invites: ${error.message}`);
    return count ?? 0;
}


// --- Handler ---
export async function POST(req: Request) {
  try {
    const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk || !pk.startsWith("0x")) {
      return NextResponse.json(
        { error: "RELAYER_PRIVATE_KEY missing/invalid" },
        { status: 500 }
      );
    }
    const account = privateKeyToAccount(pk);

    const body = await req.json();
    const { vault, action, user, nonce, deadline, amount, lockType, fid } = body;

    if (!vault || !action || !user || !nonce || !deadline) {
      return NextResponse.json(
        { error: "bad_request: missing required fields" },
        { status: 400 }
      );
    }

    let signature: `0x${string}`;
    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });

    // --- StakingVault ---
    if (vault === "staking") {
      let primaryType: "StakeAction" | "HarvestAction" | "UnstakeAction";
      let message: any;

      if (action === "stake") {
        if (!amount || !lockType)
          throw new Error("Missing amount or lockType for staking");
        primaryType = "StakeAction";
        message = {
          user,
          amount: parseEther(amount),
          lockType: Number(lockType),
          nonce: BigInt(nonce),
          deadline: BigInt(deadline),
        };
      } else if (action === "harvest") {
        primaryType = "HarvestAction";
        message = { user, nonce: BigInt(nonce), deadline: BigInt(deadline) };
      } else if (action === "unstake") {
        if (!amount) throw new Error("Missing amount for unstaking");
        primaryType = "UnstakeAction";
        message = {
          user,
          amount: parseEther(amount),
          nonce: BigInt(nonce),
          deadline: BigInt(deadline),
        };
      } else {
        throw new Error("Invalid staking action");
      }

      signature = await account.signTypedData({
        domain: STAKING_VAULT_DOMAIN,
        types: STAKING_TYPES,
        primaryType,
        message,
      });

    // --- SpinVault ---
    } else if (vault === "spin") {
      if (action !== "claim") throw new Error("Invalid spin action");

      // --- LOGIKA PENGECEKAN TIKET BARU ---
      const currentEpoch = await publicClient.readContract({
        address: spinVaultAddress,
        abi: spinVaultABI,
        functionName: 'epochNow',
      } as any); // <-- FIX

      const hasClaimedDaily = await publicClient.readContract({
        address: spinVaultAddress,
        abi: spinVaultABI,
        functionName: 'claimed',
        args: [currentEpoch, user],
      } as any); // <-- FIX

      if (hasClaimedDaily) {
          // Daily spin sudah dipakai, cek bonus tiket
          const totalInvites = await countAllInvites(user);
          const usedTickets = await publicClient.readContract({
              address: spinVaultAddress,
              abi: spinVaultABI,
              functionName: 'usedTickets',
              args: [user],
          } as any); // <-- FIX

          const availableBonusTickets = totalInvites - Number(usedTickets);
          if (availableBonusTickets <= 0) {
              throw new Error("No ticket available. Daily spin has been used and you have no bonus tickets.");
          }
      }
      // Jika daily belum diklaim, langsung proses (eligible)
      // --- AKHIR LOGIKA PENGECEKAN ---

      signature = await account.signTypedData({
        domain: SPIN_VAULT_DOMAIN,
        types: SPIN_TYPES,
        primaryType: "Spin",
        message: {
          user,
          nonce: BigInt(nonce),
          deadline: BigInt(deadline),
        },
      });

      // --- Leaderboard Supabase integration ---
      if (SUPABASE_URL && SUPABASE_ANON_KEY && fid) {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          await supabase.functions
            .invoke("add-spin-points", { body: { fid } })
            .catch(console.error);
        } catch (err) {
          console.error("Supabase leaderboard update failed:", err);
        }
      }
    } else {
      throw new Error("Invalid vault type");
    }

    return NextResponse.json({ signature });
  } catch (e: any) {
    console.error("sign-event-action error:", e);
    return NextResponse.json(
      { error: e?.message || "signature_error" },
      { status: 400 }
    );
  }
}
