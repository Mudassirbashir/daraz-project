import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { userHasPermission } from "@/lib/rbac/guards";
import { AppRole } from "@/types/database.types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    // Role-Based Authorization Check
    const supabaseAdmin = createAdminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole: AppRole = (profile?.role as AppRole) || "ops_manager";
    if (!userHasPermission(userRole, "admin:full")) {
      return NextResponse.json({ success: false, error: "Forbidden: Super Admin access required." }, { status: 403 });
    }

    const { data: teamProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role, updated_at");

    const teamMembers = (teamProfiles || []).map((p) => ({
      id: p.id,
      name: p.full_name || "Team Member",
      email: p.email || "",
      role: p.role,
      status: "active",
      lastActive: p.updated_at || new Date().toISOString(),
    }));

    const systemIntegrations = {
      darazAppKeyConfigured: !!process.env.DARAZ_APP_KEY,
      darazAppSecretConfigured: !!process.env.DARAZ_APP_SECRET,
      supabaseUrlConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      supabaseServiceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://daraz-project-drab.vercel.app",
    };

    return NextResponse.json({
      success: true,
      teamMembers,
      systemIntegrations,
    });
  } catch (err: any) {
    console.error("[GET /api/admin/users Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch admin team status." },
      { status: 500 }
    );
  }
}
