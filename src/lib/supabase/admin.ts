import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Administrative Supabase Client utilizing the SUPABASE_SERVICE_ROLE_KEY.
 * WARNING: This client bypasses Row Level Security (RLS).
 * Only use in secure server-side routes or actions requiring system-level access.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!serviceRoleKey) {
    console.error("[Supabase Admin Error] SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
  }

  return createSupabaseClient<any>(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
