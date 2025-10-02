// app/api/frame/route.ts
import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "https://basetc.xyz",
  "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Health check (validator sering GET ke webhook)
 */
export async function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      ...CORS,
    },
  });
}

/**
 * Beberapa validator melakukan HEAD
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...CORS,
    },
  });
}

/**
 * Preflight CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
    },
  });
}

/**
 * Webhook frame action (tetap POST 200)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("Webhook hit /api/frame:", body);

    // TODO: verifikasi signature / simpan event (opsional)

    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS,
      },
    });
  } catch (err) {
    console.error("Error /api/frame:", err);
    return new NextResponse(JSON.stringify({ ok: false }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...CORS,
      },
    });
  }
}

