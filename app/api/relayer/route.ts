// app/api/relayer/route.ts
import { NextResponse } from "next/server";
import { getRelayerClients } from "../../lib/server/relayerClient"; // ⬅️ was "@/app/lib/server/relayerClient"
import { CFG } from "../../lib/web3Config";                          // ⬅️ was "@/app/lib/web3Config"

export const runtime = "nodejs"; // paksa ke Node runtime

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action as string | undefined;

    const { publicClient, walletClient, gameCore } = await getRelayerClients();

    if (action === "set-active") {
      const user = body?.user as `0x${string}`;
      const active = Boolean(body?.active);

      if (!user) {
        return NextResponse.json({ ok: false, error: "missing user" }, { status: 400 });
      }

      const hash = await gameCore.write.setActive([user, active]); // sesuai ABI terbaru
      return NextResponse.json({ ok: true, hash });
    }

    if (action === "push-snapshot") {
      const user = body?.user as `0x${string}`;
      if (!user) {
        return NextResponse.json({ ok: false, error: "missing user" }, { status: 400 });
      }
      const hash = await gameCore.write.pushSnapshot([user]);
      return NextResponse.json({ ok: true, hash });
    }

    if (action === "finalize-epoch") {
      const e = BigInt(body?.epoch ?? 0);
      const totalHash = BigInt(body?.totalHash ?? 0);
      const baseSum = BigInt(body?.baseSum ?? 0);
      const hash = await gameCore.write.finalizeEpoch([e, totalHash, baseSum]);
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

