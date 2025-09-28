"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatUnits } from "viem";
import {
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

/* ---------- Minimal ERC20 ---------- */
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance",stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
] as const;

/* ---------- Farcaster FID helper (best effort) ---------- */
async function getFarcasterFID(): Promise<bigint | null> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const rawCtx: any = (mod as any)?.sdk?.context;
    let ctx: any = null;
    if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
    else ctx = rawCtx ?? null;
    const fid: number | null = ctx?.user?.fid ?? null;
    return typeof fid === "number" && Number.isFinite(fid) ? BigInt(fid) : null;
  } catch {
    return null;
  }
}

/* ---------- Small UI helpers ---------- */
const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TierImg: Record<"basic"|"pro"|"legend", string> = {
  basic: "/img/vga_basic.png",
  pro: "/img/vga_pro.gif",
  legend: "/img/vga_legend.gif",
};

/* ---------- Slot box ---------- */
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={`w-12 h-12 md:w-16 md:h-16 rounded-md flex items-center justify-center border-2 ${
      filled ? "bg-green-500/20 border-green-500/50" : "bg-neutral-800 border-neutral-700"
    }`}
  >
    {filled ? (
      <Image
        src={TierImg[tier]}
        alt={`${tier} rig`}
        width={48}
        height={48}
        className="object-contain"
      />
    ) : null}
  </div>
);

/* ---------- Main ---------- */
export default function Rakit() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;

  const [msg, setMsg] = useState<string>("");

  /* --- NFT IDs --- */
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId= useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });
  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  /* --- Owned balances (for “Owned: N”) --- */
  const basicBal  = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && BASIC  !== undefined ? [user, BASIC] : undefined,
    query: { enabled: Boolean(user && BASIC  !== undefined) },
  });
  const proBal    = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && PRO    !== undefined ? [user, PRO] : undefined,
    query: { enabled: Boolean(user && PRO    !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && LEGEND !== undefined ? [user, LEGEND] : undefined,
    query: { enabled: Boolean(user && LEGEND !== undefined) },
  });

  const ownedBasic  = (basicBal.data  as bigint | undefined) ?? 0n;
  const ownedPro    = (proBal.data    as bigint | undefined) ?? 0n;
  const ownedLegend = (legendBal.data as bigint | undefined) ?? 0n;

  /* --- Usage (used vs cap visual) --- */
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });
  const [
    /* bOwned (unused for UI slots) */ , bUsed = 0n, /* bIdle */ ,
    /* pOwned */                       , pUsed = 0n, /* pIdle */ ,
    /* lOwned */                       , lUsed = 0n, /* lIdle */ ,
  ] = ((miningUsage.data as bigint[] | undefined) ?? []).concat([0n,0n,0n,0n,0n,0n,0n,0n,0n]) as bigint[];

  const rigCaps = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "rigCaps",
  });
  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return {
      b: Number(rc?.b ?? 0n),
      p: Number(rc?.p ?? 0n),
      l: Number(rc?.l ?? 0n),
    };
  }, [rigCaps.data]);

  /* --- Merge needs & fees --- */
  const needB2P = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "BASIC_TO_PRO_NEED" });
  const needP2L = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "PRO_TO_LEGEND_NEED" });
  const needBP = (needB2P.data as bigint | undefined) ?? 10n;
  const needPL = (needP2L.data as bigint | undefined) ?? 5n;

  const feeTokenRead = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "mergeFeeToken",
  });
  const feeToken = (feeTokenRead.data as `0x${string}` | undefined) ?? undefined;

  const feeB2PRead = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeBasicToPro",
  });
  const feeP2LRead = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeProToLegend",
  });

  const feeDecimalsRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(feeToken) },
  });
  const feeSymbolRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(feeToken) },
  });
  const allowanceRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: user ? [user, gameCoreAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(user && feeToken) },
  });

  const feeDecimals = (feeDecimalsRead.data as number | undefined) ?? 18;
  const feeSymbol = (feeSymbolRead.data as string | undefined) ?? "FEE";
  const feeB2P = (feeB2PRead.data as bigint | undefined) ?? 0n;
  const feeP2L = (feeP2LRead.data as bigint | undefined) ?? 0n;
  const allowance = (allowanceRead.data as bigint | undefined) ?? 0n;

  const feeB2PView = Number(formatUnits(feeB2P, feeDecimals));
  const feeP2LView = Number(formatUnits(feeP2L, feeDecimals));

  /* --- TX writer (we use async to sequence approve -> merge) --- */
  const { writeContractAsync } = useWriteContract();

  async function mergeBasicToPro() {
    try {
      if (!user) return alert("Connect wallet dulu.");
      if (!onBase) return alert("Please switch to Base Sepolia.");
      if (caps.p <= 0) return alert("Kontrak rigCaps.p = 0. Mohon set caps Pro > 0.");
      if (ownedBasic < needBP) return alert(`Butuh ${String(needBP)} Basic untuk merge.`);
      if (Number(pUsed) >= caps.p) return alert(`Pro slot penuh (${Number(pUsed)}/${caps.p}).`);

      const fid = (await getFarcasterFID()) ?? 0n;

      // Approve kalau perlu
      if (allowance < feeB2P) {
        const h1 = await writeContractAsync({
          address: feeToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [gameCoreAddress as `0x${string}`, feeB2P],
          account: user,
          chain: baseSepolia,
        });
        await publicClient!.waitForTransactionReceipt({ hash: h1 });
      }

      // Merge
      const h2 = await writeContractAsync({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeBasicToPro",
        args: [user, fid],
        account: user,
        chain: baseSepolia,
      });
      setMsg(`Merge submitted: ${h2}`);
      await publicClient!.waitForTransactionReceipt({ hash: h2 });
      setMsg("✅ Merge Basic → Pro success.");
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message || "Merge failed");
      alert(setMsg);
    }
  }

  async function mergeProToLegend() {
    try {
      if (!user) return alert("Connect wallet dulu.");
      if (!onBase) return alert("Please switch to Base Sepolia.");
      if (caps.l <= 0) return alert("Kontrak rigCaps.l = 0. Mohon set caps Legend > 0.");
      if (ownedPro < needPL) return alert(`Butuh ${String(needPL)} Pro untuk merge.`);
      if (Number(lUsed) >= caps.l) return alert(`Legend slot penuh (${Number(lUsed)}/${caps.l}).`);

      const fid = (await getFarcasterFID()) ?? 0n;

      // Approve kalau perlu
      if (allowance < feeP2L) {
        const h1 = await writeContractAsync({
          address: feeToken as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [gameCoreAddress as `0x${string}`, feeP2L],
          account: user,
          chain: baseSepolia,
        });
        await publicClient!.waitForTransactionReceipt({ hash: h1 });
      }

      // Merge
      const h2 = await writeContractAsync({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeProToLegend",
        args: [user, (await getFarcasterFID()) ?? 0n],
        account: user,
        chain: baseSepolia,
      });
      setMsg(`Merge submitted: ${h2}`);
      await publicClient!.waitForTransactionReceipt({ hash: h2 });
      setMsg("✅ Merge Pro → Legend success.");
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message || "Merge failed");
      alert(setMsg);
    }
  }

  /* --- UI --- */
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      {/* Basic */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Basic Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedBasic)}</p>
          </div>
          <Image src={TierImg.basic} alt="Basic rig" width={64} height={64} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot key={`b-${i}`} filled={i < Number(bUsed)} tier="basic" />
          ))}
        </div>
        <button
          onClick={mergeBasicToPro}
          disabled={
            !user ||
            !onBase ||
            ownedBasic < needBP ||
            caps.p <= 0 ||
            Number(pUsed) >= caps.p
          }
          className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
            !user ||
            !onBase ||
            ownedBasic < needBP ||
            caps.p <= 0 ||
            Number(pUsed) >= caps.p
              ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {`Merge ${String(needBP)} for Pro`}
          <span className="ml-2 text-xs text-neutral-300">
            (fee {fmt2(feeB2PView)} {feeSymbol})
          </span>
        </button>
      </section>

      {/* Pro */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pro Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedPro)}</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot key={`p-${i}`} filled={i < Number(pUsed)} tier="pro" />
          ))}
        </div>
        <button
          onClick={mergeProToLegend}
          disabled={
            !user ||
            !onBase ||
            ownedPro < needPL ||
            caps.l <= 0 ||
            Number(lUsed) >= caps.l
          }
          className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
            !user ||
            !onBase ||
            ownedPro < needPL ||
            caps.l <= 0 ||
            Number(lUsed) >= caps.l
              ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-500 text-white"
          }`}
        >
          {`Merge ${String(needPL)} for Legend`}
          <span className="ml-2 text-xs text-neutral-300">
            (fee {fmt2(feeP2LView)} {feeSymbol})
          </span>
        </button>
      </section>

      {/* Legend */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Legend Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedLegend)}</p>
          </div>
          <Image src={TierImg.legend} alt="Legend rig" width={64} height={64} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot key={`l-${i}`} filled={i < Number(lUsed)} tier="legend" />
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          Per-wallet Legend limit mengikuti <code>rigCaps.l</code> (default 3). Jika sudah penuh, merge ke Legend akan dinonaktifkan.
        </p>
      </section>

      {!!msg && (
        <p className="text-xs text-emerald-400 pt-2 text-center break-words">{msg}</p>
      )}
    </div>
  );
}

