import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl.trim();
  }
  return "https://wpmeihwfxahifdidgiac.supabase.co";
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envKey && envKey.trim().length > 10) {
    return envKey.trim();
  }
  return "sb_publishable_" + "wj4PMqg5UvZ7mhsGQU6I1g_NbnJrWb2";
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
