import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    throw new Error(
      "Missing Environment Variable: 'NEXT_PUBLIC_SUPABASE_URL' is not configured in Vercel Environment Variables. Please add NEXT_PUBLIC_SUPABASE_URL in Vercel Settings -> Environment Variables and trigger a redeployment."
    );
  }
  return envUrl.trim();
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envKey || !envKey.trim()) {
    throw new Error(
      "Missing Environment Variable: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' is not configured in Vercel Environment Variables. Please add NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Settings -> Environment Variables and trigger a redeployment."
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
