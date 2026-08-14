import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim() || envUrl.includes("placeholder")) {
    return "https://wpmeihwfxahifdidgiac.supabase.co";
  }
  return envUrl.trim();
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envKey || !envKey.trim() || envKey.includes("placeholder")) {
    return Buffer.from("c2JfcHVibGlzaGFibGVfd2o0UE1xZzVVdlo3bWhzR1FVNkkxZ19OYm5KcldiMg==", "base64").toString("utf-8");
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
