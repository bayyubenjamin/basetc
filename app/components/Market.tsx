// app/components/Market.tsx
"use client";

import { useEffect, useMemo, useState, type FC, useCallback } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { base } from "viem/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";
import { getFidRefFallback } from "../lib/utils";

/* =============================
   Invite math (original rules)
   ============================= */
function maxClaimsFrom(totalInvites: number): number {
  const n = Math.floor(Number(totalInvites) || 0);
  if (n < 1) return 0;
  return 1 + Math.floor((n - 1) / 2);
}
function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0;
  const nextThreshold = 1 + 2 * nowMax;
  return Math.max(0, nextThreshold - totalInvites);
}

/* =============================
   Minimal ERC20 ABI (approval path)
   ============================= */
const erc20ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/* =============================
   UI meta for each tier
   ============================= */
type TierID = "basic" | "pro" | "legend";
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  description: string;
}
const NFT_DATA: NFTTier[] = [
  { id: "basic", name: "Basic Rig", image: "/img/vga_basic.png", hashrateHint: "~1.5 H/s", description: "Claim a free starter rig to begin mining." },
  { id: "pro", name: "Pro Rig", image: "/img/vga_pro.png", hashrateHint: "~8.0 H/s", description: "Upgrade to significantly increase hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.png", hashrateHint: "~100.0 H/s", description: "Top-tier rig for maximum performance." },
];

/* =============================
   Popup & Loading Overlay
   ============================= */
const CenterPopup: FC<{ open: boolean; message: string; onOK: () => void }> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white/90 text-[var(--text)] shadow-2xl border border-[color:rgba(0,0,0,.06)] backdrop-blur-md">
          <div className="p-5 text-center text-sm leading-relaxed whitespace-pre-line">
            {message || "Done."}
          </div>
          <div className="pb-4 flex justify-center">
            <button onClick={onOK} className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm hover:opacity-90 active:scale-[0.99]">OK</button>
          </div>
        </div>
      </div>
    </>
  );
};
const LoadingOverlay: FC<{ show: boolean; label?: string }> = ({ show, label }) =>
  show ? (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-[1010] grid place-items-center">
        <div className="flex items-center gap-3 rounded-xl bg-white/90 text-[var(--text)] border border-[color:rgba(0,0,0,.06)] px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="h-5 w-5 rounded-full border-2 border-[rgba(0,0,0,.2)] border-t-transparent animate-spin" />
          <span className="text-sm">{label ?? "Processing…"}</span>
        </div>
      </div>
    </>
  ) : null;

/* =============================
   Component
   ============================= */
const Market: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [message, setMessage] = useState("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function beginProcessing(msg: string) { setMessage(msg); setLoading(true); setPopupOpen(false); }
  function finishSuccess(msg: string) { setMessage(msg); setLoading(false); setPopupOpen(true); }
  function finishError(msg: string) { setMessage(msg); setLoading(false); setPopupOpen(true); }
  function simplifyError(e: any): string {
    const raw = (e?.shortMessage || e?.message || "").toLowerCase();
    if (raw.includes("transfer amount exceeds balance")) return "USDC tidak cukup.";
    if (raw.includes("insufficient funds")) return "ETH tidak cukup.";
    if (raw.includes("insufficient allowance")) return "Allowance kurang.";
    if (raw.includes("user rejected")) return "Transaksi dibatalkan.";
    return "Gagal. Coba lagi.";
  }

  /* ---------- Rig IDs & Kontrak ---------- */
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  const { data: modeVal } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" });
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  const mode = Number(modeVal ?? 0);

  const { data: tokenDecimalsRaw } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr && mode === 1) },
  });
  const { data: tokenSymbolRaw } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "symbol",
    query: { enabled: Boolean(tokenAddr && mode === 1) },
  });
  const tokenDecimals: number = (tokenDecimalsRaw as number | undefined) ?? 18;
  const tokenSymbol: string = (tokenSymbolRaw as string | undefined) ?? "TOKEN";

  const { data: allowance = 0n } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && tokenAddr && mode === 1) },
  });

  // ✅ Tambahan: Hook saldo USDC fix
  const { data: erc20BalRaw, refetch: refetchErc20Bal } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "balanceOf",
    args: address && tokenAddr ? [address] : undefined,
    query: { enabled: Boolean(address && tokenAddr && mode === 1) },
  });
  const erc20Bal: bigint = (erc20BalRaw as bigint | undefined) ?? 0n;

  /* ---------- Harga ---------- */
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC] });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO] });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND] });
  const priceOf = (id?: unknown) => (id === BASIC ? priceBasic : id === PRO ? pricePro : priceLegend);

  /* =============================
     Handle Buy (dengan pre-check saldo fix)
     ============================= */
  const handleBuy = async (id: bigint, tier: TierID) => {
    try {
      if (!address) return finishError("Hubungkan wallet dulu.");
      const unitPrice = priceOf(id) as bigint | undefined;
      if (!unitPrice || unitPrice === 0n) return finishError("Item tidak dijual.");
      const q = 1n;
      const totalPrice = unitPrice * q;

      if (mode === 0) {
        const ethBal = await publicClient!.getBalance({ address });
        if (ethBal < totalPrice) return finishError("ETH tidak cukup.");
        beginProcessing("Mengirim transaksi (ETH)…");
        const tx = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI,
          functionName: "buyWithETH",
          args: [id, q],
          value: totalPrice,
          account: address,
          chain: base,
        });
        await publicClient!.waitForTransactionReceipt({ hash: tx });
      } else if (mode === 1 && tokenAddr) {
        await refetchErc20Bal?.();
        const bal = erc20Bal;
        if (bal < totalPrice) {
          return finishError(`USDC tidak cukup. Butuh ${formatUnits(totalPrice, tokenDecimals)} ${tokenSymbol}.`);
        }

        if ((allowance as bigint) < totalPrice) {
          beginProcessing("Approve kontrak…");
          const approveTx = await writeContractAsync({
            address: tokenAddr as Address,
            abi: erc20ABI,
            functionName: "approve",
            args: [rigSaleAddress, totalPrice],
            account: address,
            chain: base,
          });
          await publicClient!.waitForTransactionReceipt({ hash: approveTx });
        }

        beginProcessing("Mengirim transaksi (USDC)…");
        const tx = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI,
          functionName: "buyWithERC20",
          args: [id, q],
          account: address,
          chain: base,
        });
        await publicClient!.waitForTransactionReceipt({ hash: tx });
      }

      finishSuccess("Pembelian berhasil! Buka Monitoring untuk mulai mining.");
    } catch (e: any) {
      finishError(simplifyError(e));
    }
  };

  /* =============================
     UI - DIPERTAHANKAN
   ============================= */
  return (
    <div className="fin-wrap fin-content-pad-bottom px-1.5 pt-1.5 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text)]">Market</h1>
        <p className="text-sm text-[var(--muted)] font-semibold">Mint rigs and invite to earn</p>
      </header>

      {NFT_DATA.map((tier) => {
        const id = tier.id === "basic" ? (BASIC as bigint) : tier.id === "pro" ? (PRO as bigint) : (LEGEND as bigint);
        const p = priceOf(id);
        const priceText = p ? (mode === 0 ? `${formatEther(p)} ETH` : `${formatUnits(p, tokenDecimals)} ${tokenSymbol}`) : "N/A";
        return (
          <div key={tier.id} className="fin-card p-3 neu">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-md neu-inner border border-white/5 flex items-center justify-center overflow-hidden">
                <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--text)]">{tier.name}</h3>
                <p className="text-xs text-[var(--muted)] font-semibold">{tier.description}</p>
                <p className="text-[11px] text-[var(--muted)]">Est. Hashrate: <b>{tier.hashrateHint}</b></p>
              </div>
              <div className="text-xs font-bold text-[var(--text)]">{priceText}</div>
            </div>
            <button
              onClick={() => handleBuy(id, tier.id)}
              disabled={loading}
              className="mt-3 w-full fin-btn neu-btn py-2 text-xs"
            >
              {loading ? "Processing…" : "Buy"}
            </button>
          </div>
        );
      })}

      <LoadingOverlay show={loading} label={message} />
      <CenterPopup open={popupOpen} message={message} onOK={() => setPopupOpen(false)} />
    </div>
  );
};

export default Market;