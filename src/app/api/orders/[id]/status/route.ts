import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { status, notes } = body as { status: string; notes?: string };

    if (!status) {
      return NextResponse.json({ success: false, error: "Missing required 'status' parameter." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, employee_id")
      .eq("id", user.id)
      .maybeSingle();

    const operatorName = profile?.full_name || profile?.employee_id || user.email || "Ops Manager";

    // Fetch order
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    const previousStatus = order.workflow_status || order.status;

    // Update order workflow status
    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        workflow_status: status,
        updated_at: timestamp,
      })
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update order status: ${updateErr.message}`);
    }

    // Record activity log
    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: previousStatus,
      new_status: status,
      actor: operatorName,
      source: "Staff UI",
      notes: notes || `Order status transitioned from ${previousStatus} to ${status}`,
    });

    // Record audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      actor_name: operatorName,
      entity_type: "order",
      entity_id: order.id,
      action: "status_transition",
      changes: {
        previous_status: previousStatus,
        new_status: status,
        notes: notes || null,
      },
      source: "local",
    });

    return NextResponse.json({
      success: true,
      message: `✓ Status updated to ${status.replace(/_/g, " ").toUpperCase()}`,
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/status Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update status." },
      { status: 500 }
    );
  }
}
