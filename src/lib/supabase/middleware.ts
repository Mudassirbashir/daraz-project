import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { Database } from "@/types/database.types";

const DEFAULT_URL = "https://wpmeihwfxahifdidgiac.supabase.co";
const DEFAULT_ANON_KEY = "sb_publishable_wj4PMqg5UvZ7mhsGQU6I1g_NbnJrWb2";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;

  try {
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
    } = await supabase.auth.getUser();

    return { supabaseResponse, user, supabase };
  } catch (err: any) {
    console.error("[Middleware UpdateSession Exception]:", err.message);
    return { supabaseResponse, user: null, supabase: null };
  }
}
