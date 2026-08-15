import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  return envUrl.trim();
}

function getValidServiceRoleKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!envKey || !envKey.trim()) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }
  return envKey.trim();
}

/**
 * Administrative Supabase Client utilizing the SUPABASE_SERVICE_ROLE_KEY.
 * WARNING: This client bypasses Row Level Security (RLS).
 * Only use in secure server-side routes or actions requiring system-level access.
 */
export function createAdminClient() {
  const url = getValidSupabaseUrl();
  const serviceRoleKey = getValidServiceRoleKey();

  return createSupabaseClient<any>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
