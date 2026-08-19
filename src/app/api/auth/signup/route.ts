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
      id: provisioned.userId,
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
