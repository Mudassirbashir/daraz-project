import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

const DEFAULT_URL = "https://wpmeihwfxahifdidgiac.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_wj4PMqg5UvZ7mhsGQU6I1g_NbnJrWb2";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  return createSupabaseClient<Database>(url, key);
}
