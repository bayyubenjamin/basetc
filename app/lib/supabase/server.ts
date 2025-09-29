import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY; // fallback

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

