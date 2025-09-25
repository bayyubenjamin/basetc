"use client";

import { useState, useEffect } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

// Helper ambil FID Farcaster (client-only, aman untuk Next)
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

const Rakit: FC = () => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");

  // ------- Ambil ID tier dari kontrak (BASIC/PRO/LEGEND) -------
  const basicId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "BASIC",
  });
  const proId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "PRO",
  });
  const legendId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "LEGEND",
  });

  const BASIC = basicId.data as bigint | undefined;
  const PRO = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  // ------- Baca jumlah NFT user per tier -------
  const basicBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && BASIC !== undefined ? [address, BASIC] : undefined,
    query: { enabled: Boolean(address && BASIC !== undefined) },
  });
  const proBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && PRO !== undefined ? [address, PRO] : undefined,
    query: { enabled: Boolean(address && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });

  const basicCount = (basicBal.data as bigint | undefined) ?? 0n;
  const proCount = (proBal.data as bigint | undefined) ?? 0n;
  const legendCount = (legendBal.data as bigint | undefined) ?? 0n;

  // ------- Syarat merge dari GameCore -------
  const needBasicToPro = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "BASIC_TO_PRO_NEED",
  });
  const needProToLegend = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "PRO_TO_LEGEND_NEED",
  });

  const needBP = (needBasicToPro.data as bigint | undefined) ?? 10n; // fallback aman
  const needPL = (needProToLegend.data as bigint | undefined) ?? 5n;

  // ------- TX hooks -------
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) setMessage("Merge success!");
    if (error) {
      const err: any = error;
      setMessage(err?.shortMessage || err?.message || "Merge failed");
    }
  }, [isSuccess, error]);

  // ------- Handler merge -------
  const convertBasicToPro = async () => {
    if (!address) return setMessage("Connect wallet first.");
    if (basicCount < needBP) return;
    if (isPending || waitingReceipt) return;

    setMessage("");
    const fid = await getFarcasterFID();
    if (fid === null) {
      setMessage("Farcaster FID not found.");
      return;
    }

    // GameCore.mergeBasicToPro(address, fid)
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "mergeBasicToPro",
      args: [address as `0x${string}`, fid as bigint] as const,
      account: address as `0x${string}`,
      chainId: BASE_CHAIN_ID,
    });
    setMessage(`Merging ${needBP} Basic → 1 Pro…`);
  };

  const convertProToLegend = async () => {
    if (!address) return setMessage("Connect wallet first.");
    if (proCount < needPL) return;
    if (isPending || waitingReceipt) return;

    setMessage("");
    const fid = await getFarcasterFID();
    if (fid === null) {
      setMessage("Farcaster FID not found.");
      return;
    }

    // GameCore.mergeProToLegend(address, fid)
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "mergeProToLegend",
      args: [address as `0x${string}`, fid as bigint] as const,
      account: address as `0x${string}`,
      chainId: BASE_CHAIN_ID,
    });
    setMessage(`Merging ${needPL} Pro → 1 Legend…`);
  };

  const unlockSlot = () => {
    // Placeholder UX — nanti bisa di-wire ke fungsi on-chain jika ada
    setMessage("Slot unlocked! You can now equip an extra GPU.");
  };

  const merging = isPending || waitingReceipt;

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      {/* Inventory counts (dibaca dari on-chain) */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Basic</div>
          <div className="text-lg font-semibold">x{String(basicCount)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Pro</div>
          <div className="text-lg font-semibold">x{String(proCount)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Legend</div>
          <div className="text-lg font-semibold">x{String(legendCount)}</div>
        </div>
      </div>

      {/* Merge actions */}
      <div className="space-y-2">
        <button
          onClick={convertBasicToPro}
          disabled={!address || basicCount < needBP || merging}
          className={`w-full px-3 py-2 text-xs rounded-md ${
            !address || basicCount < needBP || merging
              ? "bg-neutral-700 text-neutral-500"
              : "bg-neutral-700 hover:bg-neutral-600 text-white"
          }`}
          title={!address ? "Connect wallet first" : undefined}
        >
          {merging ? "Merging…" : `${String(needBP)} Basic → 1 Pro`}
        </button>

        <button
          onClick={convertProToLegend}
          disabled={!address || proCount < needPL || merging}
          className={`w-full px-3 py-2 text-xs rounded-md ${
            !address || proCount < needPL || merging
              ? "bg-neutral-700 text-neutral-500"
              : "bg-neutral-700 hover:bg-neutral-600 text-white"
          }`}
          title={!address ? "Connect wallet first" : undefined}
        >
          {merging ? "Merging…" : `${String(needPL)} Pro → 1 Legend`}
        </button>

        <button
          onClick={unlockSlot}
          className="w-full px-3 py-2 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white"
        >
          Unlock Slot
        </button>
      </div>

      {!!message && <p className="text-xs text-green-400 pt-2">{message}</p>}
    </div>
  );
};

export default Rakit;

