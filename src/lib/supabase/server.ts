import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    console.warn("[Supabase Server Client Warning]: NEXT_PUBLIC_SUPABASE_URL environment variable is missing. Using fallback URL configuration.");
    return "https://placeholder-supabase-url.supabase.co";
  }
  return envUrl.trim();
}

function getValidAnonKey(): string {
  const envKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!envKey || !envKey.trim()) {
    console.warn("[Supabase Server Client Warning]: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is missing. Using fallback key configuration.");
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbGxiYWNrIiwicm9sZSI6ImFub24ifQ.placeholder_key";
  }
  return envKey.trim();
}

export function createClient() {
  const cookieStore = cookies();
  const url = getValidSupabaseUrl();
  const anonKey = getValidAnonKey();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (err: any) {
            // Server Component cookie manipulation notice
          }
        },
      },
    }
  );
}
