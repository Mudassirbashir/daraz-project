import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("[Supabase Client Error] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
  }

  return createBrowserClient<Database>(
    url || "",
    anonKey || ""
  );
}
