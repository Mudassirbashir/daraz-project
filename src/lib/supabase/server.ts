import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    throw new Error(
      "Missing Environment Variable: 'NEXT_PUBLIC_SUPABASE_URL' is missing. Please configure NEXT_PUBLIC_SUPABASE_URL in your environment variables."
    );
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
    throw new Error(
      "Missing Environment Variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' is missing. Please configure Supabase keys in your environment variables."
    );
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
