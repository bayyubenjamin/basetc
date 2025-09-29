// app/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with admin privileges for server-side operations.
 * This client uses the service role key, which bypasses all RLS policies.
 * It should NEVER be used on the client-side.
 * @returns SupabaseClient
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Export the admin client instance for compatibility with existing code.
export const supabaseAdmin = getSupabaseAdmin();

