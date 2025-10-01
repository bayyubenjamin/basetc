// app/lib/shareReferral.ts
// Utility to open the Farcaster composer with prefilled text + embed.
// Uses @farcaster/miniapp-sdk when available; falls back to Warpcast deep link.

import { sdk } from '@farcaster/miniapp-sdk'

/** Clean, non-cringey English presets */
export const CAST_PRESETS = {
  concise: (refUrl: string) =>
    `Join BaseTC Console and start mining with a free Basic rig.\n${refUrl}`,

  invite: (refUrl: string) =>
    `I’m mining on BaseTC Console—grab a free Basic rig and try it.\n${refUrl}`,

  socialProof: (refUrl: string) =>
    `Mining on BaseTC Console has been smooth so far. Free Basic rig to get started:\n${refUrl}`,

  valueForward: (refUrl: string) =>
    `BaseTC Console: simple mining, clear ROI targets, and a free Basic rig to begin.\n${refUrl}`,
}

type ShareReferralOptions = {
  referralUrl: string
  /** Provide your own text or use a preset above */
  text?: string
}

/** Open composer with prefilled text + embed (normal feed, no channelKey) */
export async function shareReferral({ referralUrl, text }: ShareReferralOptions) {
  if (!referralUrl) throw new Error('Missing referralUrl')

  const castText = text ?? CAST_PRESETS.concise(referralUrl) // default preset

  // Try native Mini App composer first
  try {
    await sdk.actions.composeCast({
      text: castText,
      embeds: [referralUrl],
    })
    return
  } catch {
    // Fall back to Warpcast universal compose link (works on web & mobile)
    const composeUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
      castText
    )}&embeds[]=${encodeURIComponent(referralUrl)}`
    try {
      await sdk.actions.openUrl(composeUrl) // inside Mini App
    } catch {
      if (typeof window !== 'undefined') {
        window.open(composeUrl, '_blank') // plain browser
      }
    }
  }
}

