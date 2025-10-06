// scripts/snap.ts
// @ts-nocheck
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';

// ===== ENV =====
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  RPC,
  VAULT,
  OWNER_PK,
  TOTAL_POOL_WEI = '0',
  OUT_DIR = 'public/snapshots'
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RPC || !VAULT || !OWNER_PK) {
  throw new Error('Missing env (SUPABASE_URL / SUPABASE_SERVICE_KEY / RPC / VAULT / OWNER_PK)');
}

// ===== CONFIG TIER (atur via ENV kalau mau) =====
const TIERS = [
  { from: 1,   to: 100,  pct: 30 },
  { from: 101, to: 300,  pct: 20 },
  { from: 301, to: 1000, pct: 50 },
];

// ===== HELPERS =====
const BN = (x: string | number | bigint) => BigInt(x);
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(OWNER_PK!, provider);

const vaultAbi = [
  'function openSnapshot(uint256 snapshotId, bytes32 merkleRoot, uint256 totalAmount, uint64 claimUntil) external'
];
const vault = new ethers.Contract(VAULT!, vaultAbi, wallet);

// Leaf = keccak256(abi.encodePacked(uint256,address,uint256))
function leafHash(snapshotId: number, addr: string, amount: bigint): Buffer {
  const packed = ethers.solidityPacked(
    ['uint256','address','uint256'],
    [snapshotId, addr, amount]
  ); // returns 0x...
  return Buffer.from(packed.slice(2), 'hex');
}

async function main() {
  const args = process.argv.slice(2);
  const snapshotId = Number(args[0]);
  const openNow = args.includes('--open');
  if (!snapshotId) throw new Error('Usage: npx ts-node scripts/snap.ts <snapshotId> [--open]');

  // 1) Ambil top-1000 dari view
  const { data, error } = await supabase
    .from('leaderboard_view')
    .select('fid, rank, total_points')
    .order('rank', { ascending: true })
    .limit(1000);
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('leaderboard_view empty');

  // 2) Ambil wallet address dari tabel users
  const fids = data.map((r:any) => r.fid);
  const { data: users, error: uerr } = await supabase
    .from('users')
    .select('fid, wallet')
    .in('fid', fids);
  if (uerr) throw uerr;

  const addrByFid = new Map<number,string>();
  (users || []).forEach((u:any)=> {
    if (u.wallet) addrByFid.set(u.fid, String(u.wallet).toLowerCase());
  });

  // 3) Bagi pool per tier
  const totalPool = BN(TOTAL_POOL_WEI);
  const poolA = (totalPool * BN( TIERS[0].pct )) / 100n;
  const poolB = (totalPool * BN( TIERS[1].pct )) / 100n;
  const poolC = totalPool - poolA - poolB;

  const countA = TIERS[0].to - TIERS[0].from + 1;
  const countB = TIERS[1].to - TIERS[1].from + 1;
  const countC = TIERS[2].to - TIERS[2].from + 1;

  const perA = countA>0 ? (poolA / BN(countA)) : 0n;
  const perB = countB>0 ? (poolB / BN(countB)) : 0n;
  const perC = countC>0 ? (poolC / BN(countC)) : 0n;

  const amountForRank = (rank:number):bigint => {
    if (rank>=TIERS[0].from && rank<=TIERS[0].to) return perA;
    if (rank>=TIERS[1].from && rank<=TIERS[1].to) return perB;
    if (rank>=TIERS[2].from && rank<=TIERS[2].to) return perC;
    return 0n;
  };

  // 4) Build leaves + entries
  const leaves: Buffer[] = [];
  const entries: Record<string,{amount:string, proof:string[]}> = {};

  for (const row of data) {
    const addr = addrByFid.get(row.fid);
    if (!addr) continue;
    const amt  = amountForRank(row.rank);
    if (amt === 0n) continue;

    const leaf = leafHash(snapshotId, addr, amt); // Buffer
    leaves.push(leaf);
  }

  // 5) Build Merkle tree (keccak256, sortPairs)
  const tree = new MerkleTree(leaves, (d:Buffer)=> keccak256(d), { sortPairs: true, sortLeaves: true });
  const root = '0x' + tree.getRoot().toString('hex');

  // 6) Proof per address
  for (const row of data) {
    const addr = addrByFid.get(row.fid);
    if (!addr) continue;
    const amt  = amountForRank(row.rank);
    if (amt === 0n) continue;

    const leaf = leafHash(snapshotId, addr, amt);
    const proof = tree.getProof(leaf).map(p => '0x' + p.data.toString('hex'));
    entries[addr] = { amount: amt.toString(), proof };
  }

  // 7) Tulis JSON
  mkdirSync(OUT_DIR!, { recursive: true });
  const payload = {
    snapshotId,
    merkleRoot: root,
    totalAmount: totalPool.toString(),
    claimUntil: 0,
    entries
  };
  writeFileSync(join(OUT_DIR!, `${snapshotId}.json`), JSON.stringify(payload, null, 2));
  writeFileSync(join(OUT_DIR!, 'index.json'), JSON.stringify({
    current: snapshotId,
    url: `/${OUT_DIR!.split('/').pop()}/${snapshotId}.json`
  }, null, 2));

  console.log(`✅ Snapshot #${snapshotId} saved. root=${root}`);

  // 8) (opsional) openSnapshot on-chain
  if (openNow) {
    console.log('🔓 Calling openSnapshot on-chain...');
    const tx = await vault.openSnapshot(snapshotId, root, totalPool, 0);
    console.log('tx:', tx.hash);
    await tx.wait();
    console.log('✅ openSnapshot confirmed.');
  }
}

main().catch((e)=> {
  console.error(e);
  process.exit(1);
});

