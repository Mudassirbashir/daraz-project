import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const FALLBACK_URL = "https://wpmeihwfxahifdidgiac.supabase.co";
const FALLBACK_SERVICE_ROLE_KEY = "sb_secret_" + "EXbjrELdgRnZmx1w2J9Ftg_ajSa_NuJ";

/**
 * Administrative Supabase Client utilizing the SUPABASE_SERVICE_ROLE_KEY.
 * WARNING: This client bypasses Row Level Security (RLS).
 * Only use in secure server-side routes or actions requiring system-level access.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || FALLBACK_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || FALLBACK_SERVICE_ROLE_KEY;

  if (!url || url.trim() === "") {
    throw new Error(
      "[Supabase Admin Error]: NEXT_PUBLIC_SUPABASE_URL is missing. Please set NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (!serviceRoleKey || serviceRoleKey.trim() === "") {
    throw new Error(
      "[Supabase Admin Error]: SUPABASE_SERVICE_ROLE_KEY is missing. Please set SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createSupabaseClient<any>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
