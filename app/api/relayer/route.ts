// app/api/relayer/route.ts
import { NextResponse } from "next/server";
import { getRelayerClients } from "../../lib/server/relayerClient";
import { CFG } from "../../lib/web3Config";
import type { Address } from "viem";
import { baseSepolia } from "viem/chains";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    const { walletClient } = await getRelayerClients();

    if (action === "set-active") {
      const user = body?.user as Address | undefined;
      const active = Boolean(body?.active);
      if (!user) return NextResponse.json({ ok: false, error: "missing user" }, { status: 400 });

      const hash = await walletClient.writeContract({
        address: CFG.addresses.GAMECORE as Address,
        abi: CFG.abis.gameCore as any,
        functionName: "setActive",
        args: [user, active],
        chain: baseSepolia,
        account: walletClient.account!,
      });
      return NextResponse.json({ ok: true, hash });
    }

    if (action === "push-snapshot") {
      const user = body?.user as Address | undefined;
      if (!user) return NextResponse.json({ ok: false, error: "missing user" }, { status: 400 });

      const hash = await walletClient.writeContract({
        address: CFG.addresses.GAMECORE as Address,
        abi: CFG.abis.gameCore as any,
        functionName: "pushSnapshot",
        args: [user],
        chain: baseSepolia,
        account: walletClient.account!,
      });
      return NextResponse.json({ ok: true, hash });
    }

    if (action === "finalize-epoch") {
      const e = BigInt(body?.epoch ?? 0);
      const totalHash = BigInt(body?.totalHash ?? 0);
      const baseSum = BigInt(body?.baseSum ?? 0);

      const hash = await walletClient.writeContract({
        address: CFG.addresses.GAMECORE as Address,
        abi: CFG.abis.gameCore as any,
        functionName: "finalizeEpoch",
        args: [e, totalHash, baseSum],
        chain: baseSepolia,
        account: walletClient.account!,
      });
      return NextResponse.json({ ok: true, hash });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.shortMessage || e?.message || "server error" },
      { status: 500 }
    );
  }
}

