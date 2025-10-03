// app/components/Spin.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  formatEther,
  decodeAbiParameters,
  parseEventLogs,
} from "viem";
import type { Hex } from "viem";
import {
  spinVaultAddress,
  spinVaultABI,
  baseTcAddress,
  baseTcABI,
} from "../lib/web3Config";
import { useFarcaster } from "../context/FarcasterProvider";

const Spin: FC = () => {
  const { address, isConnected } = useAccount();
  const { user: fcUser } = useFarcaster();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // UI state
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);

  // ---------- Reads ----------
  // Current epoch
  const { data: epoch } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "epochNow",
  });

  // Claimed this epoch?
  const {
    data: claimed,
    refetch: refetchClaimed,
  } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "claimed",
    args:
      epoch !== undefined && address
        ? [epoch as bigint, address as `0x${string}`]
        : undefined,
    query: { enabled: Boolean(address && epoch !== undefined) },
  });

  // Referral tickets available (from SpinVault → RigSale.inviteCount - used)
  const {
    data: tickets,
    refetch: refetchTickets,
  } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "availableTickets",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Nonce for EIP-712
  const {
    data: nonceValue,
    refetch: refetchNonces,
  } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "nonces",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Real-time SpinVault pool balance (BaseTC)
  const {
    data: vaultBalance,
    refetch: refetchVaultBalance,
  } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI as any, // must expose balanceOf(address)
    functionName: "balanceOf",
    args: [spinVaultAddress],
  });

  // Periodic refreshes (pool & tickets)
  useEffect(() => {
    const t = setInterval(() => {
      refetchVaultBalance();
      refetchTickets();
    }, 15000);
    return () => clearInterval(t);
  }, [refetchVaultBalance, refetchTickets]);

  const ticketNum = useMemo(
    () => (typeof tickets === "bigint" ? Number(tickets) : 0),
    [tickets]
  );

  const canClaim = useMemo(() => {
    // Allow click if:
    // - not yet claimed this epoch, OR
    // - already claimed but has referral tickets > 0
    if (!isConnected || !address) return false;
    if (claimed === false) return true;
    if (claimed === true && ticketNum > 0) return true;
    return false;
  }, [isConnected, address, claimed, ticketNum]);

  const poolBalanceStr = useMemo(() => {
    try {
      return vaultBalance !== undefined
        ? Number(formatEther(vaultBalance as bigint)).toFixed(4)
        : "—";
    } catch {
      return "—";
    }
  }, [vaultBalance]);

  // ---------- Action ----------
  const handleSpin = async () => {
    if (!isConnected || !address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!fcUser?.fid) {
      setStatus("Farcaster FID is missing.");
      return;
    }
    if (!canClaim) {
      setStatus("Already claimed & no referral tickets.");
      return;
    }

    setLoading(true);
    setStatus("1/4: Fetching nonce…");
    setSpinResult(null);

    try {
      // Fresh nonce (fallback to cached)
      const nonceHook = (nonceValue as bigint | undefined) ?? 0n;
      const ref = await refetchNonces();
      const currentNonce = (ref?.data as bigint | undefined) ?? nonceHook;
      if (currentNonce === undefined || currentNonce === null) {
        throw new Error("Could not fetch a valid nonce. Try again.");
      }

      // Ask backend for EIP-712 signature (Spin)
      setStatus("2/4: Requesting signature…");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
      const sigRes = await fetch("/api/sign-event-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault: "spin",
          action: "claim",
          user: address,
          fid: fcUser.fid,
          nonce: currentNonce.toString(),
          deadline: deadline.toString(),
        }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData?.signature) {
        throw new Error(sigData?.error || "Failed to get signature.");
      }

      // Send tx (user pays gas)
      setStatus("3/4: Sending transaction…");
      const txHash = await writeContractAsync({
        address: spinVaultAddress,
        abi: spinVaultABI as any,
        functionName: "claimWithSig",
        args: [
          address as `0x${string}`,
          currentNonce,
          deadline,
          sigData.signature as `0x${string}`,
        ],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });

      // Wait & parse event
      setStatus("4/4: Waiting for confirmation…");
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: txHash,
      });

      // Try strict event parsing first
      let wonStr: string | null = null;
      try {
        const events = (parseEventLogs({
          abi: spinVaultABI as any,
          logs: receipt.logs as any,
          eventName: "ClaimedSpin",
        }) || []) as any[];

        const amt: bigint | undefined = events?.[0]?.args?.amount;
        if (typeof amt === "bigint") {
          wonStr = Number(formatEther(amt)).toFixed(6); // finer display for small rewards
        }
      } catch {
        // Fallback: decode first log from SpinVault address
        const log = receipt.logs.find(
          (l) => l.address.toLowerCase() === spinVaultAddress.toLowerCase()
        );
        if (log) {
          try {
            const [amountOut /*, tierOut*/] = decodeAbiParameters(
              [{ type: "uint256" }, { type: "uint8" }] as const,
              log.data as Hex
            );
            wonStr = Number(formatEther(amountOut as bigint)).toFixed(6);
          } catch {
            // ignore
          }
        }
      }

      setSpinResult(wonStr);
      setStatus("Spin successful!");

      // Refresh post-claim state
      await Promise.all([
        refetchClaimed(),
        refetchNonces(),
        refetchTickets(),
        refetchVaultBalance(),
      ]);
    } catch (e: any) {
      setStatus(`Error: ${e?.shortMessage || e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Calm blue spin animation ----------
  const SpinAnimation = () => (
    <div className="mx-auto my-2 h-20 w-20 rounded-full bg-[conic-gradient(at_70%_70%,#3b82f6,#06b6d4,#22d3ee,#3b82f6)] animate-spin shadow-lg" />
  );

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700 text-center">
      <h2 className="text-lg font-semibold">Daily Spin</h2>
      <p className="text-sm text-neutral-400">
        Spin once per epoch to win $BaseTC rewards. Extra spins come from referrals.
      </p>

      {/* Pool balance */}
      <div className="mx-auto max-w-md rounded-lg border border-neutral-700 bg-neutral-800/60 px-4 py-3 text-left">
        <div className="text-xs uppercase tracking-wide text-neutral-400">
          Spin Pool (real-time)
        </div>
        <div className="mt-1 text-2xl font-semibold">
          {poolBalanceStr}{" "}
          <span className="text-base text-neutral-400">$BaseTC</span>
        </div>
      </div>

      {/* Tickets */}
      {isConnected && (
        <div className="text-sm text-neutral-300">
          Tickets available:{" "}
          <span className="font-semibold">{ticketNum}</span>
        </div>
      )}

      {/* Spin button + animation */}
      <div className="py-6">
        {loading && <SpinAnimation />}
        <button
          onClick={handleSpin}
          disabled={loading || !canClaim}
          className="px-8 py-4 rounded-full bg-gradient-to-br from-blue-500 to-sky-600 text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-transform"
        >
          {loading
            ? "Spinning…"
            : canClaim
            ? "Spin Now!"
            : "No spins left this epoch"}
        </button>
      </div>

      {spinResult && (
        <div className="text-2xl font-bold text-yellow-400">
          You won {spinResult} $BaseTC!
        </div>
      )}

      {status && (
        <p className="text-xs text-neutral-400 pt-2 break-all">{status}</p>
      )}
    </div>
  );
};

export default Spin;

