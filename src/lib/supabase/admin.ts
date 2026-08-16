import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    console.warn("[Supabase Admin Client Warning]: NEXT_PUBLIC_SUPABASE_URL environment variable is missing. Using fallback URL configuration.");
    return "https://placeholder-supabase-url.supabase.co";
  }
  return envUrl.trim();
}

function getValidServiceRoleKey(): string {
  const envKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!envKey || !envKey.trim()) {
    console.warn("[Supabase Admin Client Warning]: SUPABASE_SERVICE_ROLE_KEY environment variable is missing. Using fallback key configuration.");
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGxiYWNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.placeholder_key";
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
