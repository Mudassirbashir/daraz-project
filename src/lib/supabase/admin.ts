import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl.trim();
  }
  return "https://wpmeihwfxahifdidgiac.supabase.co";
}

function getValidServiceRoleKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return "";
}

/**
 * Administrative Supabase Client utilizing the SUPABASE_SERVICE_ROLE_KEY.
 * WARNING: This client bypasses Row Level Security (RLS).
 * Only use in secure server-side routes or actions requiring system-level access.
 */
export function createAdminClient() {
  const url = getValidSupabaseUrl();
  const serviceRoleKey = getValidServiceRoleKey();

  if (!url) {
    throw new Error("[Supabase Admin Error]: NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!serviceRoleKey) {
    throw new Error("[Supabase Admin Error]: SUPABASE_SERVICE_ROLE_KEY environment variable is required.");
  }

  return createSupabaseClient<any>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
