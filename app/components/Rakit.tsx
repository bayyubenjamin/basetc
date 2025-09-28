"use client";

import { useState, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatUnits } from "viem";
import {
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

/** Minimal ERC20 ABI untuk fee token */
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type:"address" },{ type:"address" }], outputs: [{ type:"uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type:"address" },{ type:"uint256" }], outputs: [{ type:"bool" }] },
] as const;

type MergeKind = "BASIC_TO_PRO" | "PRO_TO_LEGEND";

/** Helper format angka */
function fmt2(n: number | string) {
  const v = typeof n === "string" ? Number(n) : n;
  return isFinite(v)
    ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export default function Rakit() {
  const { address, chainId } = useAccount();
  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;

  // ==== read data from contract ====
  const miningUsage = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });

  const rigCaps = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "rigCaps",
  });

  const needB2P = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "BASIC_TO_PRO_NEED",
  });

  const needP2L = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "PRO_TO_LEGEND_NEED",
  });

  const feeB2P = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "feeBasicToPro",
  });

  const feeP2L = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "feeProToLegend",
  });

  const feeTokenAddr = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "mergeFeeToken",
  });
  const feeToken = (feeTokenAddr.data as `0x${string}` | undefined) ?? undefined;

  const feeDecimals = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(feeToken) },
  });
  const feeSymbol = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(feeToken) },
  });

  const allowance = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: user ? [user, gameCoreAddress] : undefined,
    query: { enabled: Boolean(user && feeToken) },
  });

  // ==== parse values ====
  const [
    bOwned, bUsed, bIdle,
    pOwned, pUsed, pIdle,
    lOwned, lUsed, lIdle,
  ] = useMemo(() => {
    const arr = (miningUsage.data as bigint[] | undefined) ?? [];
    return [
      Number(arr[0] ?? 0n), Number(arr[1] ?? 0n), Number(arr[2] ?? 0n),
      Number(arr[3] ?? 0n), Number(arr[4] ?? 0n), Number(arr[5] ?? 0n),
      Number(arr[6] ?? 0n), Number(arr[7] ?? 0n), Number(arr[8] ?? 0n),
    ] as const;
  }, [miningUsage.data]);

  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return {
      b: Number(rc?.b ?? 0n),
      p: Number(rc?.p ?? 0n),
      l: Number(rc?.l ?? 0n),
    };
  }, [rigCaps.data]);

  const need = {
    b2p: Number((needB2P.data as bigint | undefined) ?? 10n),
    p2l: Number((needP2L.data as bigint | undefined) ?? 5n),
  };

  const feeTokenDecimals = (feeDecimals.data as number | undefined) ?? 18;
  const feeTokSym = (feeSymbol.data as string | undefined) ?? "FEE";
  const rawFeeB2P = (feeB2P.data as bigint | undefined) ?? 0n;
  const rawFeeP2L = (feeP2L.data as bigint | undefined) ?? 0n;
  const feeB2PReadable = Number(formatUnits(rawFeeB2P, feeTokenDecimals));
  const feeP2LReadable = Number(formatUnits(rawFeeP2L, feeTokenDecimals));

  const rawAllowance = (allowance.data as bigint | undefined) ?? 0n;

  // slot availability
  const proSlotAvailable = pUsed < caps.p;
  const legSlotAvailable = lUsed < caps.l;
  const legendHardLimit = caps.l; // default 3
  const legendAtLimit = lOwned >= legendHardLimit;

  // ==== approve + merge ====
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: receiptLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || receiptLoading;

  const [fid, setFid] = useState<number>(0);

  function onApprove(amount: bigint) {
    if (!user || !feeToken) return;
    writeContract({
      address: feeToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [gameCoreAddress, amount],
      account: user,
      chain: baseSepolia,
    });
  }

  async function requestMerge(kind: MergeKind) {
    if (!user) return;
    if (!onBase) return alert("Switch network ke Base Sepolia");

    if (kind === "BASIC_TO_PRO") {
      if (bOwned < need.b2p) return alert(`Butuh ${need.b2p} Basic`);
      if (!proSlotAvailable) return alert("Pro slot penuh");
      if (rawAllowance < rawFeeB2P) return alert("Approve fee dulu");
    } else {
      if (pOwned < need.p2l) return alert(`Butuh ${need.p2l} Pro`);
      if (!legSlotAvailable) return alert("Legend slot penuh");
      if (legendAtLimit) return alert(`Legend limit = ${legendHardLimit}`);
      if (rawAllowance < rawFeeP2L) return alert("Approve fee dulu");
    }

    const resp = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, kind, fid }),
    });
    const { ok, tx } = await resp.json();
    if (!ok) return alert("Merge gagal server");
    alert(`Merge tx: ${tx}`);
  }

  // ==== UI simple (pakai desain asli) ====
  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold">Build Rig</h1>
      <p className="text-sm text-neutral-400">Kelola NFT Rig, slot, dan upgrade via merge.</p>

      {/* Slots */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <CardTier tier="Basic" owned={bOwned} used={bUsed} idle={bIdle} cap={caps.b} />
        <CardTier tier="Pro" owned={pOwned} used={pUsed} idle={pIdle} cap={caps.p} />
        <CardTier tier="Legend" owned={lOwned} used={lUsed} idle={lIdle} cap={caps.l} />
      </div>

      {/* Merge actions */}
      <div className="space-y-3">
        <MergeBox
          title="10 Basic → 1 Pro"
          fee={`${fmt2(feeB2PReadable)} ${feeTokSym}`}
          disabled={!user || busy || !proSlotAvailable}
          onApprove={() => onApprove(rawFeeB2P)}
          onMerge={() => requestMerge("BASIC_TO_PRO")}
        />
        <MergeBox
          title="5 Pro → 1 Legend"
          fee={`${fmt2(feeP2LReadable)} ${feeTokSym}`}
          disabled={!user || busy || !legSlotAvailable || legendAtLimit}
          onApprove={() => onApprove(rawFeeP2L)}
          onMerge={() => requestMerge("PRO_TO_LEGEND")}
        />
      </div>

      {/* Info */}
      <div className="text-xs text-neutral-400 space-y-1">
        <div>Reward hanya dihitung sesuai slot (Basic {caps.b}, Pro {caps.p}, Legend {caps.l}).</div>
        <div>Legend limit per wallet = {legendHardLimit}. {legendAtLimit && <span className="text-red-400">Sudah maksimum.</span>}</div>
      </div>
    </div>
  );
}

function CardTier({ tier, owned, used, idle, cap }: { tier: string; owned: number; used: number; idle: number; cap: number }) {
  return (
    <div className="bg-neutral-800/60 rounded-lg p-3 border border-neutral-700">
      <div className="text-sm text-neutral-300">{tier}</div>
      <div className="text-xs text-neutral-400">Owned: <b>{owned}</b></div>
      <div className="text-xs text-neutral-400">Used: <b>{used}</b> / cap {cap}</div>
      <div className="text-xs text-neutral-500">Idle: {idle}</div>
    </div>
  );
}

function MergeBox({ title, fee, disabled, onApprove, onMerge }: { title: string; fee: string; disabled: boolean; onApprove: () => void; onMerge: () => void }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <div className="flex justify-between text-sm font-semibold">
        <span>{title}</span>
        <span className="text-xs text-neutral-400">Fee: {fee}</span>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={onApprove}
          disabled={disabled}
          className={`px-3 py-1 rounded text-sm border border-neutral-700 ${
            disabled ? "bg-neutral-700 text-neutral-400" : "bg-neutral-800 hover:bg-neutral-700"
          }`}
        >
          Approve
        </button>
        <button
          onClick={onMerge}
          disabled={disabled}
          className={`px-3 py-1 rounded text-sm text-white ${
            disabled ? "bg-neutral-700 text-neutral-400" : "bg-emerald-600 hover:bg-emerald-500"
          }`}
        >
          Merge
        </button>
      </div>
    </div>
  );
}

