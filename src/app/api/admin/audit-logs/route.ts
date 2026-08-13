import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query audit logs and order activities
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: orderActivities } = await supabase
      .from("order_activities")
      .select("*, orders(daraz_order_id, customer_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      success: true,
      auditLogs: auditLogs || [],
      orderActivities: orderActivities || [],
    });
  } catch (err: any) {
    console.error("[GET /api/admin/audit-logs Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch audit logs." },
      { status: 500 }
    );
  }
}
