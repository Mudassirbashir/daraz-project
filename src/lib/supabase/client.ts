import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  }
  return envUrl.trim();
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envKey || !envKey.trim()) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
