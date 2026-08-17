import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

    let user = null;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.warn("[Middleware UpdateSession Auth Notice]:", userError.message);
        if (
          userError.message?.toLowerCase().includes("issued at future") ||
          userError.message?.toLowerCase().includes("iat")
        ) {
          const { data: sessData } = await supabase.auth.getSession();
          user = sessData?.session?.user || null;
        }
      } else {
        user = userData?.user || null;
      }
    } catch (e: any) {
      console.warn("[Middleware UpdateSession Exception]:", e?.message);
    }

    return { supabaseResponse, user, supabase };
  } catch (err: any) {
    console.error("[Middleware UpdateSession Exception]:", err.message);
    return { supabaseResponse, user: null, supabase: null };
  }
}
