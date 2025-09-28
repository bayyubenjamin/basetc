"use client";

import { useEffect, useMemo, useState } from "react";
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
  rigNftAddress, // optional jika mau tampil id NFT
  rigNftABI,     // optional
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

/** Minimal ERC20 ABI for fee token */
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
] as const;

type MergeKind = "BASIC_TO_PRO" | "PRO_TO_LEGEND";

/** Helper: format angka dengan 2 desimal + thousands separator */
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

  // ------------ Read usage & caps ------------
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });

  const rigCaps = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "rigCaps",
  });

  // needs per merge
  const needB2P = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "BASIC_TO_PRO_NEED",
  });
  const needP2L = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "PRO_TO_LEGEND_NEED",
  });

  // merge fees & fee token
  const feeB2P = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeBasicToPro",
  });
  const feeP2L = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeProToLegend",
  });
  const feeTokenAddrRead = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "mergeFeeToken",
  });
  const feeToken = (feeTokenAddrRead.data as `0x${string}` | undefined) ?? undefined;

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

  // allowance user -> gameCore
  const allowance = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: user ? [user, gameCoreAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(user && feeToken) },
  });

  // ------------ Parse usage & caps ------------
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

  // slot availability (tujuan mint hasil merge)
  const proSlotAvailable = pUsed < caps.p;
  const legSlotAvailable = lUsed < caps.l; // & wallet limit (3 default)

  // Legend wallet hard note
  const legendHardLimit = caps.l; // per kontrak default 3
  const legendAtLimit = lOwned >= legendHardLimit;

  // ------------ Approve & Request Merge ------------
  const { writeContract, data: txHash, isPending: writePending, error: writeError } = useWriteContract();
  const { isLoading: receiptLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const busy = writePending || receiptLoading;

  // default FID untuk log (boleh 0)
  const [fid, setFid] = useState<number>(0);

  // apakah perlu approve?
  const needsApproveB2P = rawAllowance < rawFeeB2P;
  const needsApproveP2L = rawAllowance < rawFeeP2L;

  function onApprove(amount: bigint) {
    if (!user || !feeToken) return;
    writeContract({
      address: feeToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [gameCoreAddress as `0x${string}`, amount],
      account: user,
      chain: baseSepolia,
    });
  }

  async function requestMerge(kind: MergeKind) {
    if (!user) return;
    if (!onBase) {
      alert("Please switch network to Base Sepolia");
      return;
    }
    // client-side guard sesuai slot & kebutuhan
    if (kind === "BASIC_TO_PRO") {
      if (bOwned < need.b2p) return alert(`Butuh ${need.b2p} Basic untuk merge`);
      if (!proSlotAvailable) return alert("Pro slot penuh. Merge dinonaktifkan agar hasil bisa terpakai.");
      if (needsApproveB2P) return alert(`Approve fee ${fmt2(feeB2PReadable)} ${feeTokSym} dulu`);
    } else {
      if (pOwned < need.p2l) return alert(`Butuh ${need.p2l} Pro untuk merge`);
      if (!legSlotAvailable) return alert("Legend slot penuh. Merge dinonaktifkan agar hasil bisa terpakai.");
      if (legendAtLimit) return alert(`Legend limit per wallet = ${legendHardLimit}. Tidak dapat menambah lagi.`);
      if (needsApproveP2L) return alert(`Approve fee ${fmt2(feeP2LReadable)} ${feeTokSym} dulu`);
    }

    // Panggil backend relayer (RELAYER_ROLE) untuk eksekusi merge
    // Pastikan kamu buat route /api/merge (lihat file di bawah)
    const resp = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        kind,
        fid: Number.isFinite(fid) ? Math.max(0, Math.floor(fid)) : 0,
      }),
    });
    if (!resp.ok) {
      const msg = await resp.text();
      alert(`Merge request ditolak server: ${msg}`);
      return;
    }
    const { ok, tx } = await resp.json();
    if (!ok) {
      alert("Merge gagal (server)");
      return;
    }
    alert(`Merge submitted: ${tx}`);
  }

  // ------------ UI ------------
  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Bulid Rig</h1>
        <p className="text-sm text-neutral-400">Upgrade NFT Rig lewat merge dan kelola slot (caps).</p>
      </header>

      {/* Slots & Usage */}
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold">Rig Slots & Usage</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <CardTier tier="Basic" owned={bOwned} used={bUsed} idle={bIdle} cap={caps.b} />
          <CardTier tier="Pro" owned={pOwned} used={pUsed} idle={pIdle} cap={caps.p} />
          <CardTier tier="Legend" owned={lOwned} used={lUsed} idle={lIdle} cap={caps.l} />
        </div>

        <ul className="text-xs text-neutral-400 list-disc pl-5 space-y-1">
          <li>
            <b>Yang dihitung</b> untuk reward hanyalah NFT hingga batas <i>slot</i> per tier
            (Basic {caps.b}, Pro {caps.p}, Legend {caps.l}); sisanya dianggap <i>idle</i>.
          </li>
          <li>
            <b>Legend limit per wallet</b>: {legendHardLimit}. {legendAtLimit ? (
              <span className="text-red-400">Kamu sudah mencapai limit; pembelian/penerimaan akan ditolak.</span>
            ) : (
              <span>Jika sudah {legendHardLimit}, pembelian/penerimaan akan ditolak.</span>
            )}
          </li>
        </ul>
      </section>

      {/* Merge Blocks */}
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex items-end gap-3">
          <div className="text-sm">
            <div className="text-neutral-400">Feature ID (FID) untuk log</div>
            <input
              type="number"
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 w-32"
              value={fid}
              onChange={(e) => setFid(Number(e.target.value || 0))}
              min={0}
            />
          </div>
        </div>

        {/* Merge Basic -> Pro */}
        <div className="border border-neutral-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">10 Basic → 1 Pro</div>
            <div className="text-xs text-neutral-400">
              Fee: {fmt2(feeB2PReadable)} {feeTokSym}
            </div>
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            Syarat: ≥{need.b2p} Basic, Pro slot tersedia ({pUsed}/{caps.p} used).
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              disabled={!user || busy || !onBase}
              onClick={() => onApprove(rawFeeB2P)}
              className={`px-3 py-2 rounded text-sm ${
                !user || busy || !onBase ? "bg-neutral-700 text-neutral-400" : "bg-neutral-800 hover:bg-neutral-700"
              } border border-neutral-700`}
              title="Approve fee token ke GameCore"
            >
              {busy ? "…" : `Approve ${feeTokSym}`}
            </button>

            <button
              disabled={
                !user ||
                busy ||
                !onBase ||
                bOwned < need.b2p ||
                !proSlotAvailable ||
                rawAllowance < rawFeeB2P
              }
              onClick={() => requestMerge("BASIC_TO_PRO")}
              className={`px-4 py-2 rounded text-sm text-white ${
                !user ||
                busy ||
                !onBase ||
                bOwned < need.b2p ||
                !proSlotAvailable ||
                rawAllowance < rawFeeB2P
                  ? "bg-neutral-700 text-neutral-400"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
              title={
                !proSlotAvailable
                  ? "Pro slot penuh; merge dinonaktifkan agar hasil terpakai"
                  : rawAllowance < rawFeeB2P
                  ? "Approve fee dulu"
                  : ""
              }
            >
              Request Merge
            </button>
          </div>
        </div>

        {/* Merge Pro -> Legend */}
        <div className="border border-neutral-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">5 Pro → 1 Legend</div>
            <div className="text-xs text-neutral-400">
              Fee: {fmt2(feeP2LReadable)} {feeTokSym}
            </div>
          </div>
          <div className="text-xs text-neutral-400 mt-1">
            Syarat: ≥{need.p2l} Pro, Legend slot tersedia ({lUsed}/{caps.l} used), wallet &lt; {legendHardLimit}.
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              disabled={!user || busy || !onBase}
              onClick={() => onApprove(rawFeeP2L)}
              className={`px-3 py-2 rounded text-sm ${
                !user || busy || !onBase ? "bg-neutral-700 text-neutral-400" : "bg-neutral-800 hover:bg-neutral-700"
              } border border-neutral-700`}
              title="Approve fee token ke GameCore"
            >
              {busy ? "…" : `Approve ${feeTokSym}`}
            </button>

            <button
              disabled={
                !user ||
                busy ||
                !onBase ||
                pOwned < need.p2l ||
                !legSlotAvailable ||
                legendAtLimit ||
                rawAllowance < rawFeeP2L
              }
              onClick={() => requestMerge("PRO_TO_LEGEND")}
              className={`px-4 py-2 rounded text-sm text-white ${
                !user ||
                busy ||
                !onBase ||
                pOwned < need.p2l ||
                !legSlotAvailable ||
                legendAtLimit ||
                rawAllowance < rawFeeP2L
                  ? "bg-neutral-700 text-neutral-400"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
              title={
                legendAtLimit
                  ? "Legend per wallet sudah maksimum"
                  : !legSlotAvailable
                  ? "Legend slot penuh; merge dinonaktifkan agar hasil terpakai"
                  : rawAllowance < rawFeeP2L
                  ? "Approve fee dulu"
                  : ""
              }
            >
              Request Merge
            </button>
          </div>
        </div>
      </section>

      {/* Info panel */}
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-2 text-xs text-neutral-400">
        <div>
          Merge membutuhkan relayer (ROLE): server akan mengeksekusi <code>mergeBasicToPro(user, fid)</code> /
          <code>mergeProToLegend(user, fid)</code> setelah kamu <b>Approve</b> fee token dan syarat terpenuhi. :contentReference[oaicite:2]{index=2}
        </div>
        <div>
          Biaya merge dibaca dari kontrak: <code>feeBasicToPro</code>, <code>feeProToLegend</code>, dan tokennya dari <code>mergeFeeToken</code>. :contentReference[oaicite:3]{index=3}
        </div>
        <div>
          Batas slot/caps dibaca via <code>rigCaps()</code>. Per-wallet Legend default {legendHardLimit}. :contentReference[oaicite:4]{index=4}
        </div>
      </section>
    </div>
  );
}

function CardTier({
  tier,
  owned,
  used,
  idle,
  cap,
}: {
  tier: string;
  owned: number;
  used: number;
  idle: number;
  cap: number;
}) {
  return (
    <div className="bg-neutral-800/60 rounded-lg p-3 border border-neutral-700">
      <div className="text-sm text-neutral-300">{tier}</div>
      <div className="text-xs text-neutral-400 mt-1">Owned: <b className="text-neutral-200">{owned}</b></div>
      <div className="text-xs text-neutral-400">Used (counted): <b className="text-neutral-200">{used}</b> / cap {cap}</div>
      <div className="text-xs text-neutral-500">Idle (not counted): {idle}</div>
    </div>
  );
}

