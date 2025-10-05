// app/components/Market.tsx
"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  // usePublicClient dihapus karena tidak lagi digunakan di handleClaimInviteReward
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";

/* =============================
   Invite math (original rules)
============================= */
function maxClaimsFrom(totalInvites: number): number {
  if (totalInvites <= 0) return 0;
  if (totalInvites <= 10) return 1 + Math.floor(Math.max(0, totalInvites - 1) / 2);
  return 5 + Math.floor((totalInvites - 10) / 3);
}
function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0;
  let t = totalInvites;
  while (maxClaimsFrom(t) < claimed + 1) t++;
  return t - totalInvites;
}

/* =============================
   Minimal ERC20 ABI (approval path)
============================= */
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ], outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ], outputs: [{ type: "bool" }]
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
  { id: "basic",  name: "Basic Rig",  image: "/img/vga_basic.png",  hashrateHint: "~1.5 H/s",  description: "Claim a free starter rig to begin mining." },
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.gif",    hashrateHint: "~5.0 H/s",  description: "Upgrade to significantly increase hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", hashrateHint: "~25.0 H/s", description: "Top-tier rig for maximum performance." },
];

/* =============================
   Component
============================= */
const Market: FC = () => {
  const { address } = useAccount();
  // const publicClient dihapus karena tidak lagi digunakan di handleClaimInviteReward
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /* ---------- Rig IDs ---------- */
  const { data: BASIC }  = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO }    = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  /* ---------- Payment mode & token ---------- */
  const { data: modeVal }   = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" }); // 0=ETH, 1=ERC20
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  const mode = Number(modeVal ?? 0);

  // Read raw (unknown) then normalize to correct types
  const { data: tokenDecimalsRaw } = useReadContract({
    address: tokenAddr as Address, abi: erc20ABI as any, functionName: "decimals",
    query: { enabled: Boolean(tokenAddr && mode === 1) },
  });
  const { data: tokenSymbolRaw } = useReadContract({
    address: tokenAddr as Address, abi: erc20ABI as any, functionName: "symbol",
    query: { enabled: Boolean(tokenAddr && mode === 1) },
  });
  const tokenDecimals: number = (tokenDecimalsRaw as number | undefined) ?? 18;
  const tokenSymbol: string = (tokenSymbolRaw as string | undefined) ?? "TOKEN";

  /* ---------- Active Prices ---------- */
  const { data: priceBasic }  = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC],  query: { enabled: Boolean(BASIC) } });
  const { data: pricePro }    = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO],    query: { enabled: Boolean(PRO) } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: Boolean(LEGEND) } });

  const priceOf = (id?: unknown) =>
    id === BASIC ? priceBasic : id === PRO ? pricePro : id === LEGEND ? priceLegend : undefined;

  /* ---------- Free mint status ---------- */
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId }   = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });

  // fid + inviter from localStorage (original flow)
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  useEffect(() => {
    const f = typeof window !== "undefined" ? window.localStorage.getItem("basetc_fid") : null;
    const r = typeof window !== "undefined" ? window.localStorage.getItem("basetc_ref") : null;
    if (f) setFid(BigInt(f));
    if (r && /^0x[0-9a-fA-F]{40}$/.test(r)) setInviter(r as Address);
  }, []);

  const { data: freeUsed, refetch: refetchFreeUsed } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "freeMintedByFid",
    args: fid !== null ? [fid] : undefined,
    query: { enabled: Boolean(fid !== null) },
  });

  const isBasicFreeForMe = Boolean(
    freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed
  );

  /* ---------- ERC20 allowance (only if needed) ---------- */
  const { data: allowance = 0n } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && tokenAddr && mode === 1) },
  });

  /* ---------- Writer ---------- */
  const { writeContractAsync } = useWriteContract();

  /* =============================
     Actions — CLAIM FREE BASIC RIG (BY INVITEE)
  ============================== */

  // Free claim (Basic) via server signature
  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet.");
      if (!isBasicFreeForMe) throw new Error("You are not eligible for free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Open from Farcaster app.");

      setMessage("1/3: Requesting server signature…");
      const sigRes = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "free-sign",
          fid: String(fid),
          to: address,
          inviter,
        }),
      });
      const sig = await sigRes.json();
      if (!sigRes.ok) throw new Error(sig?.error || "Failed to obtain signature.");

      // Menggunakan useWriteContract untuk meminta konfirmasi dompet pengguna
      setMessage("2/3: Sending transaction…");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sig.inviter, BigInt(sig.deadline), sig.v, sig.r, sig.s],
        account: address,
        chain: baseSepolia,
      });
      
      setMessage("3/3: Waiting for confirmation…");
      // Dapatkan public client (untuk menunggu receipt)
      const publicClient = (await import('wagmi')).usePublicClient();
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      // --- SINKRONISASI REFERRAL: Tandai referral sebagai 'valid' di Supabase
      if (inviter !== "0x0000000000000000000000000000000000000000") {
        setMessage("Finalizing: Updating referral status..."); 
        // Panggil API mark-valid untuk mencatat referral sebagai valid
        await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "mark-valid",
            invitee_fid: String(fid),
            invitee_wallet: address,
          }),
        });
      }
      // --- AKHIR SINKRONISASI ---

      setMessage("Claim successful! Referral counted.");
      refetchFreeUsed?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // Buy with ETH / ERC20 (approval preserved)
  const handleBuy = async (id: bigint) => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet.");
      const price = priceOf(id) as bigint | undefined;
      if (!price || price === 0n) throw new Error("Item is not for sale.");

      // Dapatkan public client (untuk menunggu receipt)
      const { usePublicClient } = await import('wagmi');
      const publicClient = usePublicClient();

      if (mode === 0) {
        const txHash = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithETH",
          args: [id, 1n],
          value: price,
          account: address,
          chain: baseSepolia,
        });
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
      } else if (mode === 1 && tokenAddr) {
        if ((allowance as bigint) < price) {
          const approveHash = await writeContractAsync({
            address: tokenAddr as Address,
            abi: erc20ABI,
            functionName: "approve",
            args: [rigSaleAddress, price],
            account: address,
            chain: baseSepolia,
          });
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        }
        const buyHash = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithERC20",
          args: [id, 1n],
          account: address,
          chain: baseSepolia,
        });
        await publicClient?.waitForTransactionReceipt({ hash: buyHash });
      } else {
        throw new Error("Unsupported payment mode.");
      }

      setMessage("Purchase success!");
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Tier helpers ---------- */
  const tierId = (t: TierID) => (t === "basic" ? (BASIC as bigint) : t === "pro" ? (PRO as bigint) : (LEGEND as bigint));
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  /* =============================
     Invite rewards (original flow)
  ============================== */
  const { data: totalInvitesData } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "inviteCountOf",
    args: address ? [address as Address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const totalInvites = totalInvitesData ? Number(totalInvitesData) : 0;

  const [claimedRewards, setClaimedRewards] = useState(0);
  useEffect(() => {
    if (!address) return;
    fetch(`/api/referral?inviter=${address}`)
      .then(r => r.json())
      .then(d => setClaimedRewards(d?.claimedRewards ?? 0))
      .catch(() => {});
  }, [address]);

  const maxClaims = useMemo(() => maxClaimsFrom(totalInvites), [totalInvites]);
  const availableClaims = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(totalInvites, claimedRewards);

  const [inviteMsg, setInviteMsg] = useState<string>("");
  const [busyInvite, setBusyInvite] = useState(false);

  // FIX: Fungsi untuk mengklaim NFT dari kuota undangan yang valid
  async function handleClaimInviteReward() {
    try {
      if (!address) throw new Error("Please connect your wallet.");
      // Tambahkan pengecekan FID, karena API 'claim' membutuhkan FID Inviter untuk poin
      if (!fid) throw new Error("Farcaster FID required for reward claim."); 

      setInviteMsg("");
      if (availableClaims <= 0) {
        return setInviteMsg(`Need ${needMoreInv} more valid invite(s) for the next claim.`);
      }
      setBusyInvite(true);
      setMessage("Klaim Reward NFT sedang diproses oleh Relayer..."); // Pesan yang lebih akurat
      
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          mode: "claim", // FIX: Tambahkan mode operasi yang benar untuk klaim reward
          inviter: address, // Alamat Anda (untuk pengecekan kuota)
          receiver: address, // Alamat yang akan menerima NFT (Anda)
          invitee_fid: String(fid), // FID Anda (Inviter) untuk dicatat sebagai referensi poin
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Klaim gagal. Periksa logs server.");

      // Karena minting dilakukan oleh relayer, kita hanya menunggu konfirmasi bahwa
      // backend telah mengirim transaksi dan mencatat kuota (yang sudah dilakukan).
      
      // Langsung perbarui status klaim lokal setelah respons sukses dari API
      setClaimedRewards(claimedRewards + 1); 
      setInviteMsg(`Reward diklaim! Transaksi relayer: ${json.txHash.slice(0, 8)}...`);
      
    } catch (e: any) {
      // Tampilkan pesan error klaim ke kotak pesan kecil
      setInviteMsg(e?.shortMessage || e?.message || "Klaim gagal.");
      setMessage(""); // Pastikan pesan transaksi umum dibersihkan
    } finally {
      setBusyInvite(false);
      setLoading(false);
    }
  }

  /* =============================
     UI (Fin look; logic intact)
  ============================== */
  return (
    <div className="fin-wrap fin-content-pad-bottom px-4 pt-4 space-y-5">
      {/* Page title */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint rigs and invite to earn</p>
      </header>

      {/* Invite card — simplified but keeps the full logic */}
      <section className="fin-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Invite Friends</h2>
            <p className="text-xs text-neutral-400">
              Valid invites unlock free Basic rig claims.
            </p>
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0 || !address} // Tambahkan !address untuk mencegah error
            className={`fin-btn fin-btn-claim text-xs ${busyInvite || availableClaims <= 0 || !address ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {busyInvite ? "Klaim diproses…" : `Klaim${availableClaims > 0 ? ` (${availableClaims})` : ""}`}
          </button>
        </div>

        <div className="mt-2 text-xs text-neutral-400">
          Invites: <b>{totalInvites}</b> • Claimed: <b>{claimedRewards}</b> • Max now: <b>{maxClaims}</b>
        </div>
        {availableClaims <= 0 && (
          <div className="text-xs text-neutral-400">
            Butuh <b>{needMoreInv}</b> undangan valid lagi untuk klaim berikutnya.
          </div>
        )}
        {/* Pesan spesifik untuk reward claim (bukan pesan transaksi umum) */}
        {!!inviteMsg && <div className="mt-2 text-xs text-blue-400">{inviteMsg}</div>} 
      </section>

      {/* Listings */}
      <section className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const p = priceOf(id);
          const priceText =
            tier.id === "basic" && isBasicFreeForMe
              ? "GRATIS"
              : p
              ? mode === 0
                ? `${formatEther(p as bigint)} ETH`
                : `${formatUnits(p as bigint, tokenDecimals)} ${tokenSymbol}`
              : "N/A";

          return (
            <div key={tier.id} className="fin-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md bg-neutral-800 border border-white/5 flex items-center justify-center overflow-hidden">
                  <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                  <p className="text-xs text-neutral-400">{tier.description}</p>
                  <p className="text-[11px] text-neutral-500">Est. Hashrate: {tier.hashrateHint}</p>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-xs text-neutral-400 mb-1">{priceText}</span>
                <button
                  onClick={onClickCta(tier.id)}
                  disabled={loading || !address || !id}
                  title={!address ? "Hubungkan dompet terlebih dahulu" : undefined}
                  className={`fin-btn fin-btn-claim px-3 py-1.5 text-xs ${loading || !address || !id ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Pesan transaksi umum (untuk klaim Basic atau Buy) */}
      {!!message && <p className="text-center text-xs text-neutral-400">{message}</p>}

      <div className="fin-bottom-space" />
    </div>
  );
};

export default Market;

