// app/lib/referrals/validate-client.ts
export async function validateReferralNow(fid: number) {
  if (!Number.isFinite(fid) || fid <= 0) return;

  try {
    // Ini memicu backend /api/user → /api/referral/validate
    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid, validate_referral_now: true }),
    });

    // Jangan bikin UI error keras kalau gagal; cukup log saja
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("validateReferralNow non-OK:", res.status, txt);
    }
  } catch (err) {
    console.warn("validateReferralNow error:", err);
  }
}

