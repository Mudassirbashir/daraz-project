import { NextRequest, NextResponse } from "next/server";
import { ensureUserExistsInSupabase } from "@/lib/supabase/seed-users";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required." }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const provisioned = await ensureUserExistsInSupabase(
      cleanEmail,
      password,
      fullName || cleanEmail.split("@")[0],
      role || "super_admin"
    );

    const userPayload = {
      id: provisioned.userId || "00000000-0000-0000-0000-000000000001",
      email: cleanEmail,
      full_name: provisioned.fullName,
      role: provisioned.role,
      user_metadata: { full_name: provisioned.fullName, role: provisioned.role },
    };

    const response = NextResponse.json({
      success: true,
      user: userPayload,
      message: "Sign up successful! Account provisioned.",
    });

    // Sync browser client Supabase authentication session if available
    try {
      const { createServerClient } = await import("@supabase/ssr");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_KEY;

      if (url && anonKey) {
        const supabase = createServerClient(url.trim(), anonKey.trim(), {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set(name, value, options);
              });
            },
          },
        });

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!error && data?.user) {
          userPayload.id = data.user.id;
        }
      }
    } catch (e: any) {
      console.warn("[Auth Signup Notice]: Supabase Auth API notice:", e.message);
    }

    response.cookies.set("daraz_ops_user", JSON.stringify(userPayload), {
      path: "/",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Sign up failed." }, { status: 500 });
  }
}
