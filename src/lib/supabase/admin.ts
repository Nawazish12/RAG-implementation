import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/** Server-only Supabase client with the service role (no end-user auth in this app). */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const env = getEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
