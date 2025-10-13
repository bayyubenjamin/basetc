// app/components/Profil.tsx (modified version)
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { FC } from "react";
import Image from "next/image";
import { useAccount, useReadContract } from "wagmi";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  rigSaleAddress,
  rigSaleABI,
} from "../lib/web3Config";
import { formatEther } from "viem";
import { useFarcaster } from "../context/FarcasterProvider";
import { sdk } from "@farcaster/miniapp-sdk";

// Types representing achievements and invited users
type Achievement = { name: string; icon: string };
type InvitedUser = {
  fid: number | null;
  wallet?: string | null;
  username?: string | null;
  display_name?: string | null;
  pfp_url?: string | null;
  status?: "valid" | "pending";
};

// Reusable SVG icon component
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function Profil() {
  const { address } = useAccount();
  const { user: fcUser, ready: fcReady } = useFarcaster();

  const [copied, setCopied] = useState(false);
  const [refAddr, setRefAddr] = useState<string | null>(null);

  // NEW: total valid dari API/DB (fallback jika kontrak 0)
  const [totalValidCount, setTotalValidCount] = useState<number>(0);

  // Read referral address (inviter) from local storage to show "Referred By" badge
  useEffect(() => {
    const r = typeof window !== "undefined" ? localStorage.getItem("basetc_ref") : null;
    if (r && /^0x[0-9a-fA-F]{40}$/.test(r)) setRefAddr(r);
  }, []);

  // NFT tier IDs
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  // NFT balances per tier
  const { data: countBasic = 0n } = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && BASIC ? [address, BASIC] : undefined,
    query: { enabled: !!(address && BASIC) },
  });
  const { data: countPro = 0n } = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && PRO ? [address, PRO] : undefined,
    query: { enabled: !!(address && PRO) },
  });
  const { data: countLegend = 0n } = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND ? [address, LEGEND] : undefined,
    query: { enabled: !!(address && LEGEND) },
  });

  // Read $BaseTC balance
  const { data: baseBal } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const baseReadable = useMemo(() => (baseBal ? formatEther(baseBal as bigint) : "0.000"), [baseBal]);

  // Check if player is Supreme
  const { data: isSupreme } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI as any,
    functionName: "isSupreme",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Build list of achievements based on NFT ownership and supreme status
  const achievements: Achievement[] = [
    ...((countBasic as bigint) > 0n
      ? [
          {
            name: "Early Miner",
            icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
          },
        ]
      : []),
    ...((countPro as bigint) > 0n
      ? [
          {
            name: "Pro Upgrader",
            icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25",
          },
        ]
      : []),
    ...((countLegend as bigint) > 0n
      ? [
          {
            name: "First Legend",
            icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z",
          },
        ]
      : []),
    ...(isSupreme
      ? [
          {
            name: "Supreme",
            icon: "M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5",
          },
        ]
      : []),
  ];

  // Read number of valid invites from contract (tetap dipertahankan)
  const { data: totalInvitesValid = 0 } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "inviteCountOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, select: (d) => Number(d) },
  });

  // Local state for invites
  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [showAllInvites, setShowAllInvites] = useState(false);

  // Fetch list of invitees from API whenever address changes
  useEffect(() => {
    if (!address) {
      setInvites([]);
      setTotalValidCount(0);
      return;
    }
    (async () => {
      setLoadingInvites(true);
      try {
        const r = await fetch(
          `/api/referral?inviter=${address}&detail=1`,
          { cache: "no-store", next: { revalidate: 0 } } as any
        );
        const j = await r.json();
        if (j?.list && Array.isArray(j.list)) {
          setInvites(
            j.list.map((u: any): InvitedUser => ({
              fid: u?.invitee_fid ?? null,
              wallet: u?.invitee_wallet ?? null,
              status: u?.status === "valid" ? "valid" : "pending",
            }))
          );
        } else {
          setInvites([]);
        }

        // NEW: pakai angka valid dari API bila ada (fallback ke hitung list)
        const apiValid = Number(j?.validInvites ?? 0);
        if (apiValid > 0) {
          setTotalValidCount(apiValid);
        } else {
          const calcValid = (j?.list || []).filter((u: any) => u?.status === "valid").length;
          setTotalValidCount(calcValid);
        }
      } catch {
        setTotalValidCount(0);
        setInvites([]);
      } finally {
        setLoadingInvites(false);
      }
    })();
  }, [address]);

  // Sinkronisasi opsional: kalau kontrak punya angka > 0, boleh override
  useEffect(() => {
    if (Number(totalInvitesValid) > 0) {
      setTotalValidCount(Number(totalInvitesValid));
    }
  }, [totalInvitesValid]);

  // === NEW: derive counts for invited users section ===
  const totalInvitedAll = invites.length;
  const totalInvitedPending = useMemo(
    () => invites.filter((u) => u.status !== "valid").length,
    [invites]
  );
  // totalValidCount sudah ditampilkan di summary atas (tetap)

  // Build short address for display
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
  // Build display name from Farcaster user info or fallback
  const displayName = fcUser?.displayName || fcUser?.username || (fcUser?.fid ? `fid:${fcUser.fid}` : "Guest");

  // Build shareable invite link.
  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin || "";
    if (fcUser?.fid) {
      return `${base}/launch?fidref=${fcUser.fid}`;
    }
    if (address) {
      return `${base}/launch?ref=${address}`;
    }
    return "";
  }, [fcUser?.fid, address]);

  // Compose Farcaster cast text for sharing
  const buildCastText = useCallback(() => "BaseTC Console: mine onchain, upgrade rigs, and earn $BaseTC.", []);

  // Handle sharing referral link via Farcaster
  const [shareLoading, setShareLoading] = useState(false);
  const onShareReferral = useCallback(async () => {
    if (!inviteLink) return;
    const castText = buildCastText();
    setShareLoading(true);
    try {
      const finalLink = `${inviteLink}&v=${Date.now().toString(36)}`;
      await sdk.actions.composeCast({ text: castText, embeds: [finalLink] });
    } catch {
      const finalLink = `${inviteLink}&v=${Date.now().toString(36)}`;
      const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(finalLink)}`;
      try {
        await sdk.actions.openUrl(composeUrl);
      } catch {
        window.open(composeUrl, "_blank");
      }
    } finally {
      setShareLoading(false);
    }
  }, [inviteLink, buildCastText]);

  // Handle copying invite link to clipboard
  const copyInviteLink = useCallback(() => {
    if (!inviteLink) return;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, [inviteLink]);

  return (
    <div className="fin-wrap fin-content-pad-bottom">
      {/* Profile Header */}
      <section className="fin-card fin-card-pad flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#0e1220] flex items-center justify-center border border-[#1b2133]">
            {fcUser?.pfpUrl ? (
              <Image src={fcUser.pfpUrl} alt="pfp" width={48} height={48} />
            ) : (
              <span className="text-xs text-neutral-400">PFP</span>
            )}
          </div>
          <div>
            <h2 className="font-bold text-[15px]">{displayName}</h2>
            <p className="text-[12px] text-[#9fb0d6] opacity-75">
              {address ? shortAddr : "—"} · FID: {fcUser?.fid ?? "—"}
            </p>
            {!!refAddr && (
              <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#1b2133] text-[10px]">
                <span className="opacity-70">Referred By</span>
                <span className="font-medium">{`${refAddr.slice(0, 6)}…`}</span>
              </div>
            )}
          </div>
        </div>
        {isSupreme && <div className="fin-badge fin-badge-active text-[11px]">Supreme</div>}
      </section>

      {/* Invites Summary */}
      <section className="fin-card fin-card-pad space-y-3">
        <h2 className="font-semibold text-[14px]">Invites</h2>
        <div className="flex justify-between text-sm">
          <div>
            <div className="text-xs text-[#9fb0d6]">Total Invited (valid)</div>
            {/* NEW: pakai totalValidCount yang diset dari API/kontrak */}
            <div className="text-lg font-bold">{totalValidCount}</div>
          </div>
          <div>
            <div className="text-xs text-[#9fb0d6]">Your $BaseTC</div>
            <div className="text-lg font-bold">{Number(baseReadable).toLocaleString()}</div>
          </div>
        </div>

        {/* Invite link and actions */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              readOnly
              value={inviteLink}
              className="w-full text-xs bg-[#0f1426] border border-[#1b2133] rounded-md px-2 py-1 text-[#d7e2ff] select-all"
            />
            {/* Copy button */}
            <button
              type="button"
              onClick={copyInviteLink}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded bg-[#1e263f] text-[#9fb0d6] hover:text-white"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            disabled={!inviteLink || shareLoading}
            onClick={onShareReferral}
            className="fin-btn fin-btn-claim w-full"
          >
            {shareLoading ? "Opening…" : "Share to Farcaster"}
          </button>
          {/* NEW: note under the share button */}
          <p className="text-[11px] text-[#9fb0d6] opacity-80">
            Only users who claimed the free rig are counted as valid.
          </p>
        </div>

        {/* Invited users table */}
        <div className="space-y-2">
          {/* NEW: show counts for all / valid / pending */}
          <div className="text-xs text-[#9fb0d6] flex items-center gap-2">
            <span>Invited Users</span>
            <span className="px-1.5 py-0.5 rounded bg-[#1b2133] text-[#d7e2ff]">Total: {totalInvitedAll}</span>
            <span className="px-1.5 py-0.5 rounded bg-[#14321d] text-[#1db954]">Valid: {totalValidCount}</span>
            <span className="px-1.5 py-0.5 rounded bg-[#3a2f10] text-[#eab308]">Pending: {totalInvitedPending}</span>
          </div>

          {/* wrapper tinggi 5 baris + scroll */}
          <div className="overflow-hidden rounded-md border border-[#1e263f]">
            <div className="max-h-44 overflow-y-auto"> {/* ~5 rows */}
              <table className="w-full text-xs">
                <thead className="bg-[#0f1426] text-[#9fb0d6] sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-2 py-1.5">User (FID)</th>
                    <th className="text-left px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInvites ? (
                    <tr>
                      <td className="px-2 py-2 text-[#9fb0d6]" colSpan={2}>
                        Loading…
                      </td>
                    </tr>
                  ) : invites.length === 0 ? (
                    <tr>
                      <td className="px-2 py-2 text-[#9fb0d6]" colSpan={2}>
                        No invites yet.
                      </td>
                    </tr>
                  ) : (
                    invites.map((u, i) => (
                      <tr key={`${u.fid ?? "x"}-${i}`} className="border-t border-[#1e263f]">
                        <td className="px-2 py-1.5">
                          {u.fid ?? "—"}
                          {u.wallet && (
                            <span className="text-[#9fb0d6] ml-1 opacity-60">({`${u.wallet.slice(0, 6)}…`})</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {u.status === "valid" ? (
                            <span className="px-2 py-0.5 rounded bg-[#1db95433] text-[#1db954] text-[10px]">
                              valid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-[#eab30833] text-[#eab308] text-[10px]">
                              pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Section */}
      <section className="fin-card fin-card-pad space-y-2">
        <h2 className="font-semibold text-[14px]">Achievements</h2>
        {achievements.length === 0 ? (
          <div className="text-xs text-[#9fb0d6]">No achievements yet…</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {achievements.map((ach) => (
              <div
                key={ach.name}
                className="flex items-center space-x-1 bg-[#0f1426] rounded-md px-2 py-1 text-xs border border-[#1e263f]"
              >
                <Icon path={ach.icon} className="w-4 h-4 text-yellow-400" />
                <span>{ach.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}