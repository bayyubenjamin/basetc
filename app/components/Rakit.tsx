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

/* === SLOT === */
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

/* ---------------- Popup + Overlay ---------------- */
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

  /* ... SEMUA BAGIAN KONTRAK & QUERY TIDAK DIUBAH ... */

  /* ---------------- UI ---------------- */
  return (
    <div className="fin-wrap fin-content-pad-bottom">
      <div className="fin-page-head">
        <h1 className="text-[var(--text)]">Build Rig</h1>
        <p className="text-[var(--muted)] font-semibold">Upgrade &amp; merge your rigs</p>
      </div>

      {/* BASIC */}
      <section className="fin-card fin-card-pad neu" aria-label="Basic rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">BASIC</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedBasic)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(bUsed)}</span>
            </small>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot key={`b-${i}`} filled={i < Math.min(Number(ownedBasic), caps.b)} tier="basic" />
          ))}
        </div>
      </section>

      {/* PRO */}
      <section className="fin-card fin-card-pad neu" aria-label="Pro rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">PRO</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedPro)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(pUsed)}</span>
            </small>
          </div>
        </div>

        {/* 🔥 FIX: hanya baris ini yang berubah */}
        <div className="mt-3 grid grid-cols-5 grid-flow-row gap-2">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot key={`p-${i}`} filled={i < Math.min(Number(ownedPro), caps.p)} tier="pro" />
          ))}
        </div>

      </section>

      {/* LEGEND */}
      <section className="fin-card fin-card-pad neu" aria-label="Legend rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">LEGEND</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedLegend)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(lUsed)}</span>
            </small>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot key={`l-${i}`} filled={i < Math.min(Number(ownedLegend), caps.l)} tier="legend" />
          ))}
        </div>
      </section>

      <LoadingOverlay show={loading} label={status || "Processing…"} />
      <CenterPopup open={popupOpen} message={status} onOK={() => setPopupOpen(false)} />
    </div>
  );
}