import { createBrowserClient } from "@supabase/ssr";
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

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const url = getValidSupabaseUrl();
  const key = getValidAnonKey();

  clientInstance = createBrowserClient<Database>(url, key);
  return clientInstance;
}
