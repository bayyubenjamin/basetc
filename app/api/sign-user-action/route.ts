// app/api/sign-user-action/route.ts
import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { gameCoreAddress as GC_ADDR_DEFAULT } from "../../lib/web3Config"; // sesuaikan path
// Jika pakai Pages Router, pindahkan file ini ke: pages/api/sign-user-action.ts (sedikit beda handler)

export const runtime = "nodejs";

type Action = "start" | "stop" | "claim";
type Body = {
  user: `0x${string}`;              // alamat user
  action: Action;                   // "start" | "stop" | "claim"
  nonce: string | number;           // dari contract: nonces(user)
  deadline?: string | number;       // optional; kalau kosong server isi now+15m
  chainId?: number;                 // optional; default NEXT_PUBLIC_CHAIN_ID atau 84532
  verifyingContract?: `0x${string}`;// optional; default gameCoreAddress dari web3Config
};

const NAME = "GameCore";
const VERSION = "1";
const ActionMap: Record<Action, number> = { start: 0, stop: 1, claim: 2 };

export async function POST(req: Request) {
  try {
    const pk = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!pk || !pk.startsWith("0x")) {
      return NextResponse.json(
        { error: "RELAYER_PRIVATE_KEY missing/invalid (must start with 0x)" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Body;
    if (!body?.user || !body?.action || body.nonce === undefined) {
      return NextResponse.json(
        { error: "bad_request: user/action/nonce required" },
        { status: 400 }
      );
    }

    const actionNum = ActionMap[body.action];
    if (actionNum === undefined) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const chainId =
      body.chainId ?? Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

    const verifyingContract =
      (body.verifyingContract as `0x${string}` | undefined) ??
      (GC_ADDR_DEFAULT as `0x${string}`);

    if (!verifyingContract) {
      return NextResponse.json({ error: "verifyingContract missing" }, { status: 400 });
    }

    // deadline default = sekarang + 15 menit
    const deadline =
      body.deadline !== undefined
        ? BigInt(body.deadline)
        : BigInt(Math.floor(Date.now() / 1000) + 15 * 60);

    // Domain & types harus persis seperti di kontrak
    const domain = { name: NAME, version: VERSION, chainId, verifyingContract };
    const types = {
      UserAction: [
        { name: "user", type: "address" },
        { name: "action", type: "uint8" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    } as const;

    const message = {
      user: body.user,
      action: actionNum,
      nonce: BigInt(body.nonce),
      deadline,
    };

    const account = privateKeyToAccount(pk);
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "UserAction",
      message,
    });

    return NextResponse.json({ signature, deadline: message.deadline.toString() });
  } catch (e: any) {
    console.error("sign-user-action error:", e);
    return NextResponse.json(
      { error: e?.message || "signature_error" },
      { status: 400 }
    );
  }
}

