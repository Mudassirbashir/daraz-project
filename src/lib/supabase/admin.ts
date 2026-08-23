import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    throw new Error(
      "Missing Environment Variable: 'NEXT_PUBLIC_SUPABASE_URL' is missing. Please configure NEXT_PUBLIC_SUPABASE_URL in your environment variables."
    );
  }
  return envUrl.trim();
}

function getValidServiceRoleKey(): string {
  // SECURITY: do NOT silently fall back to the anon key. If the service-role
  // key is missing we want a hard failure so the operator notices — never
  // run "admin" queries under the RLS-enforced anon client.
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!envKey || !envKey.trim()) {
    throw new Error(
      "Missing Environment Variable: 'SUPABASE_SERVICE_ROLE_KEY' is required for admin operations. Configure it in your environment variables."
    );
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
