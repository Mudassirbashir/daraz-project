import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const teamMembers = [
      {
        id: "usr-01",
        name: "Mubashir",
        email: "mubashir@daraz-ops.local",
        role: "super_admin",
        status: "active",
        lastActive: new Date().toISOString(),
      },
      {
        id: "usr-02",
        name: "Mudassir",
        email: "mudassir@daraz-ops.local",
        role: "product_manager",
        status: "active",
        lastActive: new Date().toISOString(),
      },
      {
        id: "usr-03",
        name: "Zainab",
        email: "zainab@daraz-ops.local",
        role: "ops_manager",
        status: "active",
        lastActive: new Date().toISOString(),
      },
    ];

    const systemIntegrations = {
      darazAppKeyConfigured: !!process.env.DARAZ_APP_KEY,
      darazAppSecretConfigured: !!process.env.DARAZ_APP_SECRET,
      supabaseUrlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseServiceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://daraz-project.vercel.app",
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
