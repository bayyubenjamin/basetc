"use client";

import { useState, useMemo } from "react";
import type { FC } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { stakingVaultAddress, stakingVaultABI, baseTcAddress, baseTcABI } from "../lib/web3Config";

const LOCK_OPTIONS = [
  { label: "7 Days (1.0x)", value: 1 },
  { label: "30 Days (1.2x)", value: 2 },
  { label: "365 Days (1.5x)", value: 3 },
];

const MAX_PRO = 5;
const MAX_LEGEND = 3;
const BOOST_CAP = 50; // %

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Contract Reads ---
  const { data: position, refetch: refetchPosition } = useReadContract({
    address: stakingVaultAddress,
    abi: stakingVaultABI as any,
    functionName: "getUser",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: pendingRewards, refetch: refetchPending } = useReadContract({
    address: stakingVaultAddress,
    abi: stakingVaultABI as any,
    functionName: "pendingReward",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: baseTcBalance, refetch: refetchBalance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI as any,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI as any,
    functionName: "allowance",
    args: [address, stakingVaultAddress],
    query: { enabled: !!address },
  });

  // --- Derived Data ---
  const stakedAmount = useMemo(() => {
    if (!position || !(position as any).tranches) return 0;
    const tranches = (position as any).tranches as { amount: bigint }[];
    return tranches.reduce((sum, t) => sum + Number(formatEther(t.amount || 0n)), 0);
  }, [position]);

  const rewards = useMemo(() => {
    if (!pendingRewards) return 0;
    try {
      return Number(formatEther(pendingRewards as bigint));
    } catch {
      return 0;
    }
  }, [pendingRewards]);

  // --- Actions ---
  const handleAction = async (action: "stake" | "unstake" | "claim") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing ${action}...`);

    try {
      if (action === "stake") {
        const stakeAmount = parseEther(amount || "0");
        if (stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
        if (stakeAmount > (baseTcBalance as bigint || 0n)) throw new Error("Insufficient balance.");

        if ((allowance as bigint || 0n) < stakeAmount) {
          setStatus("Approving $BaseTC...");
          const approveHash = await writeContractAsync({
            address: baseTcAddress,
            abi: baseTcABI as any,
            functionName: "approve",
            args: [stakingVaultAddress, stakeAmount],
            account: address,
            chain: base,
          });
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
          await refetchAllowance();
          setStatus("Approval successful. Preparing to stake...");
        }

        const txHash = await writeContractAsync({
          address: stakingVaultAddress,
          abi: stakingVaultABI as any,
          functionName: "stake",
          args: [parseEther(amount), lockType],
          account: address,
          chain: base,
        });
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        setStatus("Stake successful!");
      }

      if (action === "unstake") {
        if (stakedAmount <= 0) throw new Error("No staked amount.");
        const txHash = await writeContractAsync({
          address: stakingVaultAddress,
          abi: stakingVaultABI as any,
          functionName: "unstake",
          args: [[0], [parseEther(stakedAmount.toString())]], // unstake full first tranche
          account: address,
          chain: base,
        });
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        setStatus("Unstake successful!");
      }

      if (action === "claim") {
        if (rewards <= 0) throw new Error("No rewards to claim.");
        const txHash = await writeContractAsync({
          address: stakingVaultAddress,
          abi: stakingVaultABI as any,
          functionName: "claim",
          args: [],
          account: address,
          chain: base,
        });
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
        setStatus("Claim successful!");
      }

      await Promise.all([refetchPosition(), refetchPending(), refetchBalance(), refetchAllowance()]);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI ---
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md">
        <h2 className="text-lg font-bold text-gray-800 text-center">Staking Dashboard</h2>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Staked Amount</p>
            <p className="text-xl font-bold text-gray-900">{stakedAmount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Rewards</p>
            <p className="text-xl font-bold text-green-600">{rewards.toFixed(6)}</p>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <label className="text-xs text-gray-500">Amount to Stake</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2 mt-2">
          <label className="text-xs text-gray-500">Lock Duration</label>
          <div className="flex gap-2">
            {LOCK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLockType(opt.value as 1 | 2 | 3)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                  lockType === opt.value ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            onClick={() => handleAction("stake")}
            disabled={loading}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "..." : "Stake"}
          </button>
          <button
            onClick={() => handleAction("unstake")}
            disabled={loading || stakedAmount <= 0}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "..." : "Unstake"}
          </button>
          <button
            onClick={() => handleAction("claim")}
            disabled={loading || rewards <= 0}
            className="rounded-md bg-yellow-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "..." : "Claim"}
          </button>
        </div>

        {status && <p className="text-center text-xs text-gray-500 pt-2">{status}</p>}
      </div>
    </div>
  );
};

export default Staking;

