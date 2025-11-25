// app/components/Rakit.tsx
"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { base } from "viem/chains";
import { formatUnits, parseUnits } from "viem";
import {
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

/* ---------------- ERC20 minimal ---------------- */
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance",stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
] as const;

/* ---------------- helpers ---------------- */
const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TierImg: Record<"basic"|"pro"|"legend", string> = {
  basic: "/img/vga_basic.png",
  pro: "/img/vga_pro.png",
  legend: "/img/vga_legend.png",
};

/* Warna bingkai per tier */
const slotBorderByTier: Record<"basic"|"pro"|"legend", string> = {
  basic: "border-white/60",
  pro: "border-[#67a8ff]/80",
  legend: "border-[#f5d06f]/85",
};

/* === SLOT === (tampilan terang) */
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={[
      "relative grid place-items-center w-12 h-12 md:w-16 md:h-16",
      "rounded-[8px]",
      "border", slotBorderByTier[tier],
      "p-[1px]",
      "bg-transparent",
    ].join(" ")}
  >
    <div className="w-full h-full rounded-[7px] overflow-hidden neu-inner bg-[#f3f7ff] grid place-items-center">
      {filled ? (
        <Image
          src={TierImg[tier]}
          alt={`${tier} rig`}
          width={64}
          height={64}
          className="w-full h-full object-cover rounded-[7px]"
        />
      ) : (
        <div className="text-[10px] text-[var(--muted)] font-semibold">empty</div>
      )}
    </div>
  </div>
);

/* ---------------- Popup (visual light) + Processing overlay ---------------- */
const CenterPopup: FC<{ open: boolean; message: string; onOK: () => void }> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white/90 text-[var(--text)] shadow-2xl border border-[color:rgba(0,0,0,.06)] backdrop-blur-md">
          <div className="p-5">
            <div className="text-center text-sm leading-relaxed whitespace-pre-line">
              {message || "Done."}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={onOK}
                className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm hover:opacity-90 active:scale-[0.99]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LoadingOverlay: FC<{ show: boolean; label?: string }> = ({ show, label }) => {
  if (!show) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-[1010] grid place-items-center">
        <div className="flex items-center gap-3 rounded-xl bg-white/90 text-[var(--text)] border border-[color:rgba(0,0,0,.06)] px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="h-5 w-5 rounded-full border-2 border-[rgba(0,0,0,.2)] border-t-transparent animate-spin" />
          <span className="text-sm whitespace-pre-line">{label ?? "Processing…"}</span>
        </div>
      </div>
    </>
  );
};

/* ---------------- component ---------------- */
export default function Rakit() {
  const { address, chainId } = useAccount();
  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [popupOpen, setPopupOpen] = useState<boolean>(false);

  /* IDs */
  const basicId  = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId    = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });
  const BASIC  = basicId.data  as bigint | undefined;
  const PRO    = proId.data    as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  /* Owned balances */
  const basicBal  = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && BASIC  !== undefined ? [user, BASIC] : undefined,
    query: { enabled: Boolean(user && BASIC !== undefined) },
  });
  const proBal    = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && PRO    !== undefined ? [user, PRO] : undefined,
    query: { enabled: Boolean(user && PRO !== undefined) },
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

  /* Usage for slot usage display */
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });
  const [
    _bOwned, bUsed = 0n, _bIdle,
    _pOwned, pUsed = 0n, _pIdle,
    _lOwned, lUsed = 0n, _lIdle,
  ] = ((miningUsage.data as bigint[] | undefined) ?? []).concat([0n,0n,0n,0n,0n,0n,0n,0n,0n]) as bigint[];

  /* Slot caps */
  const rigCaps = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "rigCaps" });
  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return { b: Number(rc?.b ?? 10n), p: Number(rc?.p ?? 5n), l: Number(rc?.l ?? 3n) };
  }, [rigCaps.data]);

  /* Need & fee token */
  const needB2P = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "BASIC_TO_PRO_NEED" });
  const needP2L = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "PRO_TO_LEGEND_NEED" });
  const needBP = (needB2P.data as bigint | undefined) ?? 10n;
  const needPL = (needP2L.data as bigint | undefined) ?? 5n;

  const feeTokenRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "mergeFeeToken" });
  const feeToken = (feeTokenRead.data as `0x${string}` | undefined) ?? undefined;

  const feeB2PRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "feeBasic