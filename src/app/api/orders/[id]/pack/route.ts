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

    const supabase = createAdminClient();

    // Fetch user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, employee_id")
      .eq("id", user.id)
      .maybeSingle();

    const operatorName = profile?.full_name || profile?.employee_id || user.email || "Warehouse Staff";

    // Fetch target order
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const timestamp = new Date().toISOString();

    // Update order status to packed / ready_to_ship
    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        is_packed: true,
        packed_at: timestamp,
        packed_by: operatorName,
        status: "ready_to_ship",
        updated_at: timestamp,
      })
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code, region)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update order packing state: ${updateErr.message}`);
    }

    // Insert audit log
    await supabase.from("daraz_api_logs").insert({
      store_id: order.store_id,
      sync_type: "order_packed",
      status: "completed",
      records_synced: 1,
      payload: {
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        packed_by: operatorName,
        packed_at: timestamp,
      },
    });

    return NextResponse.json({
      success: true,
      message: "✓ Order Packed. Ready for Shipping Label.",
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/pack Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to mark order as packed." },
      { status: 500 }
    );
  }
}
