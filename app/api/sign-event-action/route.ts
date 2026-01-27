// app/api/sign-event-action/route.ts
import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { stakingVaultAddress, spinVaultAddress } from "../../lib/web3Config";
import { parseEther } from "viem";

export const runtime = "nodejs";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 8453);

// --- EIP-712 Domains ---
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
    const { vault, action, user, nonce, deadline, amount, lockType } = body;

    if (!vault || !action || !user || !nonce || !deadline) {
      return NextResponse.json(
        { error: "bad_request: missing required fields" },
        { status: 400 }
      );
    }

    let signature: `0x${string}`;

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

      // NOTE: Leaderboard update logic has been removed from here.
      // Points are now awarded via /api/points/spin after casting.

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
