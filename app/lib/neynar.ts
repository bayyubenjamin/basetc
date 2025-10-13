// app/lib/neynar.ts
import { NextResponse } from 'next/server';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.SIGNER_UUID;

interface NeynarCastResponse {
  hash: string;
  author: {
    fid: number;
    username: string;
  };
}

interface NeynarBroadcastResponse {
  id: string;
  status: 'pending' | 'success' | 'failed';
}

/**
 * Mengirim cast menggunakan Neynar Agent.
 */
export async function sendAgentCast(text: string): Promise<NeynarCastResponse> {
  if (!NEYNAR_API_KEY || !SIGNER_UUID) {
    throw new Error('NEYNAR_API_KEY atau SIGNER_UUID tidak diatur.');
  }

  const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': NEYNAR_API_KEY,
    },
    body: JSON.stringify({
      signer_uuid: SIGNER_UUID,
      text,
      embeds: [{ url: process.env.SITE_URL || 'https://basetc.xyz' }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Gagal mengirim cast.');
  }
  return data;
}

/**
 * Mengirim notifikasi broadcast ke Farcaster (jika tersedia).
 * Fallback ke Agent cast dengan mentions jika gagal.
 */
export async function sendBroadcastNotification(fids: number[], text: string): Promise<void> {
  if (!NEYNAR_API_KEY) {
    throw new Error('NEYNAR_API_KEY tidak diatur.');
  }

  try {
    const response = await fetch('https://api.neynar.com/v2/farcaster/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        fids,
        text,
      }),
    });

    if (!response.ok) {
      // Jika Broadcast API gagal (misal: tidak tersedia), fallback ke mentions.
      throw new Error('Broadcast API tidak tersedia, fallback ke mentions.');
    }

    const data: NeynarBroadcastResponse = await response.json();
    console.log(`Broadcast berhasil dikirim dengan ID: ${data.id}`);

  } catch (error) {
    console.warn('Gagal mengirim broadcast, mencoba fallback ke mentions...', error);
    // Fallback: kirim cast dengan mention
    const usersResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(',')}`, {
        headers: {
            'api_key': NEYNAR_API_KEY,
        }
    });
    const { users } = await usersResponse.json();
    const mentions = users.map((user: any) => `@${user.username}`).join(' ');

    await sendAgentCast(`${text}\n\n${mentions}`);
  }
}
