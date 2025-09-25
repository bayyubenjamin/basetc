// app/api/permit/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { gameCoreAddress } from '../../lib/web3Config';

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532); // Base Sepolia
const NAME = 'BaseTC';
const VERSION = '1';

type Body = {
  fid: number;
  user: `0x${string}`;
  action: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  referrerFid?: number | null;
  nonce: string | number;    // pakai Date.now() dari client ok
  deadline: string | number; // unix ts + beberapa menit
};

export async function POST(req: Request) {
  try {
    const pk = process.env.MINIAPP_AUTH_PK;
    if (!pk) return NextResponse.json({ error: 'missing MINIAPP_AUTH_PK' }, { status: 500 });

    const body = (await req.json()) as Body;

    // Validasi minimal
    if (!body?.fid || !body?.user || !body?.action || !body?.nonce || !body?.deadline) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    if (body.referrerFid && Number(body.referrerFid) === Number(body.fid)) {
      return NextResponse.json({ error: 'self_referral' }, { status: 400 });
    }

    // Domain EIP-712: fixed ke GameCore (hindari injection verifyingContract)
    const domain = {
      name: NAME,
      version: VERSION,
      chainId: CHAIN_ID,
      verifyingContract: gameCoreAddress as `0x${string}`,
    };

    const types = {
      PermitData: [
        { name: 'fid',         type: 'uint256' },
        { name: 'user',        type: 'address' },
        { name: 'action',      type: 'uint8' },
        { name: 'referrerFid', type: 'uint256' },
        { name: 'nonce',       type: 'uint256' },
        { name: 'deadline',    type: 'uint256' },
      ],
    } as const;

    const message = {
      fid: BigInt(body.fid),
      user: body.user,
      action: Number(body.action),
      referrerFid: BigInt(body.referrerFid ?? 0),
      nonce: BigInt(body.nonce),
      deadline: BigInt(body.deadline),
    };

    const account = privateKeyToAccount(`0x${pk}`);
    const signature = await account.signTypedData({
      domain, types, primaryType: 'PermitData', message,
    });

    // (opsional) log issued ke Supabase di sini juga

    return NextResponse.json({ signature, domain, message });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'permit_error' }, { status: 400 });
  }
}

