// app/components/Staking.tsx
"use client";

import { useState, useMemo } from "react";
import type { FC } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatEther, parseEther, type Address } from "viem";
import { stakingVaultAddress, stakingVaultABI, baseTcAddress, baseTcABI } from "../lib/web3Config";

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Contract Reads ---
  const { data: nonces, refetch: refetchNonces } = useReadContract({
    address: stakingVaultAddress,
    abi: stakingVaultABI,
    functionName: "nonces",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: position, refetch: refetchPosition } = useReadContract({
    address: stakingVaultAddress,
    abi: stakingVaultABI,
    functionName: "pos",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: pendingRewards, refetch: refetchPending } = useReadContract({
    address: stakingVaultAddress,
    abi: stakingVaultABI,
    functionName: "pending",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: baseTcBalance, refetch: refetchBalance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });
  
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI,
    functionName: "allowance",
    args: [address, stakingVaultAddress],
    query: { enabled: !!address },
  });

  const stakedAmount = useMemo(() => (position ? Number(formatEther(position[0] as bigint)) : 0), [position]);
  const rewards = useMemo(() => (pendingRewards ? Number(formatEther(pendingRewards as bigint)) : 0), [pendingRewards]);

  // --- Actions ---
  const handleAction = async (action: "stake" | "harvest" | "unstake") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing ${action}...`);

    try {
        const stakeAmount = parseEther(amount || "0");
        if (action === "stake" && stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
        if (action === "stake" && stakeAmount > (baseTcBalance as bigint)) throw new Error("Insufficient balance.");

        // 1. Approve if needed (for stake)
        if (action === "stake" && (allowance as bigint) < stakeAmount) {
            setStatus("Approving $BaseTC...");
            const approveHash = await writeContractAsync({
                address: baseTcAddress,
                abi: baseTcABI,
                functionName: "approve",
                args: [stakingVaultAddress, stakeAmount],
            });
            await publicClient?.waitForTransactionReceipt({ hash: approveHash });
            refetchAllowance();
            setStatus("Approval successful. Preparing to stake...");
        }

        // 2. Get signature from backend
        const nonce = (await refetchNonces()).data;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
        
        const sigRes = await fetch("/api/sign-event-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vault: "staking",
                action,
                user: address,
                amount: action === "unstake" ? stakedAmount.toString() : amount,
                lockType,
                nonce: String(nonce),
                deadline: String(deadline),
            }),
        });

        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || "Failed to get signature.");

        // 3. Call contract with signature
        let functionName: "stakeWithSig" | "harvestWithSig" | "unstakeWithSig";
        let args: any[];

        if (action === "stake") {
            functionName = "stakeWithSig";
            args = [address, stakeAmount, lockType, nonce, deadline, sigData.signature];
        } else if (action === "harvest") {
            functionName = "harvestWithSig";
            args = [address, nonce, deadline, sigData.signature];
        } else { // unstake
            functionName = "unstakeWithSig";
            args = [address, parseEther(stakedAmount.toString()), nonce, deadline, sigData.signature];
        }

        setStatus("Awaiting transaction confirmation...");
        const txHash = await writeContractAsync({
            address: stakingVaultAddress,
            abi: stakingVaultABI,
            functionName,
            args,
        });

        await publicClient?.waitForTransactionReceipt({ hash: txHash });

        setStatus(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`);
        refetchNonces();
        refetchPosition();
        refetchPending();
        refetchBalance();
    } catch (e: any) {
        setStatus(e?.shortMessage || e?.message || "An error occurred.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700">
        <div className="grid grid-cols-2 gap-4 text-center">
            <div>
                <p className="text-sm text-neutral-400">Your Staked Amount</p>
                <p className="text-xl font-bold">{stakedAmount.toLocaleString()}</p>
            </div>
            <div>
                <p className="text-sm text-neutral-400">Pending Rewards</p>
                <p className="text-xl font-bold text-emerald-400">{rewards.toFixed(6)}</p>
            </div>
        </div>

        <div className="space-y-2">
            <label className="text-xs text-neutral-400">Amount to Stake</label>
            <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-md bg-neutral-800 px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div className="space-y-2">
             <label className="text-xs text-neutral-400">Lock Duration</label>
            <div className="flex gap-2">
                <button onClick={() => setLockType(1)} className={`flex-1 rounded px-2 py-1 text-xs ${lockType === 1 ? 'bg-blue-600' : 'bg-neutral-700'}`}>7 Days (1.0x)</button>
                <button onClick={() => setLockType(2)} className={`flex-1 rounded px-2 py-1 text-xs ${lockType === 2 ? 'bg-blue-600' : 'bg-neutral-700'}`}>30 Days (1.2x)</button>
                <button onClick={() => setLockType(3)} className={`flex-1 rounded px-2 py-1 text-xs ${lockType === 3 ? 'bg-blue-600' : 'bg-neutral-700'}`}>365 Days (1.5x)</button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
            <button onClick={() => handleAction("stake")} disabled={loading} className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {loading ? "..." : "Stake"}
            </button>
            <button onClick={() => handleAction("harvest")} disabled={loading || rewards <= 0} className="rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {loading ? "..." : "Harvest"}
            </button>
            <button onClick={() => handleAction("unstake")} disabled={loading || stakedAmount <= 0} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {loading ? "..." : "Unstake"}
            </button>
        </div>
         {status && <p className="text-center text-xs text-neutral-400 pt-2">{status}</p>}
    </div>
  );
};
