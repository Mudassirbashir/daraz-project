import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "@/types/database.types";

function getValidSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!envUrl || !envUrl.trim()) {
    console.warn("[Supabase Middleware Notice]: NEXT_PUBLIC_SUPABASE_URL environment variable is missing. Using fallback for build.");
    return "https://placeholder.supabase.co";
  }
  return envUrl.trim();
}

function getValidAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!envKey || !envKey.trim()) {
    console.warn("[Supabase Middleware Notice]: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is missing. Using fallback for build.");
    return "placeholder-anon-key";
  }
  return envKey.trim();
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const url = getValidSupabaseUrl();
    const anonKey = getValidAnonKey();

    const supabase = createServerClient<Database>(
      url,
      anonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.warn("[Middleware UpdateSession Auth Notice]:", userError.message);
    }

    return { supabaseResponse, user, supabase };
  } catch (err: any) {
    console.error("[Middleware UpdateSession Exception]:", err.message);
    return { supabaseResponse, user: null, supabase: null };
  }
}
