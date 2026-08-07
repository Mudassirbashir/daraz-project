import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

const DEFAULT_URL = "https://wpmeihwfxahifdidgiac.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_wj4PMqg5UvZ7mhsGQU6I1g_NbnJrWb2";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  clientInstance = createBrowserClient<Database>(url, key);
  return clientInstance;
}
