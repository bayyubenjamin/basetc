'use client'

import { useState, useMemo } from 'react'
import { shareReferral, CAST_PRESETS } from '@/lib/shareReferral'

type Props = {
  referralUrl: string
  /** Choose a preset: 'concise' | 'invite' | 'socialProof' | 'valueForward' */
  preset?: keyof typeof CAST_PRESETS
  /** Optional custom copy (overrides preset) */
  customText?: string
  className?: string
  label?: string
}

export default function ShareReferralButton({
  referralUrl,
  preset = 'concise',
  customText,
  className,
  label = 'Share referral to Cast',
}: Props) {
  const [loading, setLoading] = useState(false)

  const text = useMemo(() => {
    if (customText) return customText
    const builder = CAST_PRESETS[preset] ?? CAST_PRESETS.concise
    return builder(referralUrl)
  }, [customText, preset, referralUrl])

  async function onShare() {
    if (!referralUrl) return
    setLoading(true)
    try {
      await shareReferral({ referralUrl, text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={loading || !referralUrl}
      className={
        className ??
        'w-full rounded-md px-4 py-2 text-sm font-medium bg-indigo-600 text-white ' +
          'disabled:opacity-60 active:scale-[0.98] transition'
      }
      aria-label="Share referral to Farcaster"
    >
      {loading ? 'Opening…' : label}
    </button>
  )
}

