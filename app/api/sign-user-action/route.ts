// app/api/sign-user-action/route.ts
import { NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { gameCoreAddress as GC_ADDR_DEFAULT } from '../../lib/web3Config';

export const runtime = 'nodejs';

const NAME = 'GameCore';
const VERSION = '1';

type Body = {
  user: `0x${string}`;
  action: 'start' | 'stop' | 'claim';
  nonce: string | number;     // dari contract nonces(user)
  deadline?: string | number; // optional; kalau kosong server isi +15m
  chainId?: number;           // optional; fallback ke env/public
  verifyingContract?: `0x${string}`; // optional; fallback web3Config
};

const ActionMap: Record<Body['action'], number> = { start: 0, stop: 1, claim: 2 };

export async function POST(req: Request) {
  try {
    const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk || !pk.startsWith('0x')) {
      return NextResponse.json({ error: 'Relayer PK missing or invalid (must start with 0x)' }, { status: 500 });
    }

    const body = (await req.json()) as Body;

    if (!body?.user || !body?.action || body.nonce === undefined) {
      return NextResponse.json({ error: 'bad_request: user/action/nonce required' }, { status: 400 });
    }

    const actionEnum = ActionMap[body.action];
    const chainId =
      body.chainId ??
      Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

    const verifyingContract =
      (body.verifyingContract as `0x${string}` | undefined) ?? (GC_ADDR_DEFAULT as `0x${string}`);

    if (!verifyingContract) {
      return NextResponse.json({ error: 'verifyingContract missing' }, { status: 400 });
    }

    // deadline default +15 menit jika tidak dikirim dari client
    const dl =
      body.deadline !== undefined
        ? BigInt(body.deadline)
        : BigInt(Math.floor(Date.now() / 1000) + 15 * 60);

    const domain = { name: NAME, version: VERSION, chainId, verifyingContract };
    const types = {
      UserAction: [
        { name: 'user', type: 'address' },
        { name: 'action', type: 'uint8' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    } as const;

    const message = {
      user: body.user,
      action: actionEnum,
      nonce: BigInt(body.nonce),
      deadline: dl,
    };

    const account = privateKeyToAccount(pk);
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: 'UserAction',
      message,
    });

    return NextResponse.json({ signature });
  } catch (e: any) {
    console.error('Signature Error:', e);
    return NextResponse.json({ error: e?.message ?? 'signature_error' }, { status: 400 });
  }
}

