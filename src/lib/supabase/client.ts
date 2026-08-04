import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wpmeihwfxahifdidgiac.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_wj4PMqg5UvZ7mhsGQU6I1g_NbnJrWb2";

  return createBrowserClient<Database>(url, key);
}
