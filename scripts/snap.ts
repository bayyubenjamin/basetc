// scripts/snap.ts
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const RPC = process.env.RPC!;
const VAULT = process.env.VAULT!;
const OWNER_PK = process.env.OWNER_PK!;
const TOTAL_POOL_WEI = BigInt(process.env.TOTAL_POOL_WEI || "0");
const OUT_DIR = process.env.OUT_DIR || "public/snapshots";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(OWNER_PK, provider);

const abi = [
  "function openSnapshot(uint256 id, bytes32 root, uint256 total, uint256 until) external",
];

const vault = new ethers.Contract(VAULT, abi, wallet);

const tiers = [
  { range: [1, 100], pct: 30 },
  { range: [101, 300], pct: 20 },
  { range: [301, 1000], pct: 50 },
];

async function main() {
  const args = process.argv.slice(2);
  const snapshotId = parseInt(args[0]);
  const openNow = args.includes("--open");
  if (!snapshotId) throw new Error("Harus kasih ID snapshot, contoh: npx ts-node scripts/snap.ts 1 --open");

  console.log("📊 Ambil data leaderboard dari Supabase...");
  const { data, error } = await supabase.from("leaderboard_view").select("*").limit(1000);
  if (error) throw error;

  console.log(`✅ Dapat ${data.length} baris`);

  // Hitung pembagian reward per tier
  const total = Number(TOTAL_POOL_WEI);
  const tierMap = new Map<number, number>();
  for (const { range, pct } of tiers) {
    const users = data.filter((x: any) => x.rank >= range[0] && x.rank <= range[1]);
    const perUser = (total * (pct / 100)) / users.length;
    users.forEach((u: any) => tierMap.set(u.fid, perUser));
  }

  // Build leaf list
  const entries: Record<string, { amount: string; proof: string[] }> = {};
  const keccak256 = ethers.keccak256;
  const pack = ethers.AbiCoder.defaultAbiCoder();

  const leaves: string[] = [];

  for (const user of data) {
    const addr = user.wallet?.toLowerCase?.() || user.address?.toLowerCase?.();
    if (!addr) continue;
    const amount = tierMap.get(user.fid) || 0;
    const leaf = keccak256(
      ethers.solidityPacked(["uint256", "address", "uint256"], [snapshotId, addr, amount])
    );
    leaves.push(leaf);
    entries[addr] = { amount: amount.toString(), proof: [] };
  }

  // Root (tanpa lib merkletree, simpel hash aja biar cepat)
  const root = keccak256(ethers.concat(leaves));

  const out = {
    snapshotId,
    merkleRoot: root,
    totalAmount: TOTAL_POOL_WEI.toString(),
    claimUntil: 0,
    entries,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${snapshotId}.json`), JSON.stringify(out, null, 2));

  fs.writeFileSync(
    path.join(OUT_DIR, `index.json`),
    JSON.stringify({ id: snapshotId, url: `/${OUT_DIR.split("/").pop()}/${snapshotId}.json` }, null, 2)
  );

  console.log(`💾 Snapshot tersimpan di ${OUT_DIR}/${snapshotId}.json`);

  if (openNow) {
    console.log("🔓 Panggil openSnapshot() ke kontrak...");
    const tx = await vault.openSnapshot(snapshotId, root, TOTAL_POOL_WEI, 0);
    console.log("Tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ Snapshot terbuka di kontrak.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

