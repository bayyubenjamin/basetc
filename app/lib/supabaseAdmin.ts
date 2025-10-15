// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "basetc-console-admin" } },
  });
}

