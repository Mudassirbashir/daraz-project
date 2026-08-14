import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

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

    const operatorName = profile?.full_name || profile?.employee_id || user.email || "Packing Staff";

    // Fetch order & store credentials
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const store = order.daraz_stores;
    if (!store || !store.access_token) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz store is not connected. Reconnect store via My Stores page before packing orders.",
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API /order/fulfill/pack FIRST
    // =========================================================================
    const darazClient = new DarazApiClient({
      storeId: store.id,
      accessToken: store.access_token,
      refreshToken: store.refresh_token || undefined,
      tokenExpiresAt: store.token_expires_at || undefined,
      appKey: store.api_app_key || undefined,
      appSecret: store.api_app_secret || undefined,
    });

    const itemIds = Array.isArray(order.order_items) && order.order_items.length > 0
      ? order.order_items.map((i: any) => i.order_item_id)
      : [order.daraz_order_id];

    let darazResult;
    try {
      darazResult = await darazClient.packOrder(itemIds, order.shipping_provider || "");
    } catch (apiErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz did not accept this change: ${apiErr.message}`,
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    if (!darazResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz rejected order packing request.",
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 2 - UPDATE LOCAL DB ONLY AFTER CONFIRMED SUCCESS
    // =========================================================================
    const timestamp = new Date().toISOString();

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        is_packed: true,
        packed_at: timestamp,
        packed_by: operatorName,
        workflow_status: "ready_to_ship",
        package_id: darazResult.packageId || order.package_id,
        updated_at: timestamp,
      })
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update packing status in database: ${updateErr.message}`);
    }

    // Log Activity
    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: order.workflow_status || order.status,
      new_status: "ready_to_ship",
      actor: operatorName,
      source: "Daraz API Confirmed",
      notes: `Order packed and confirmed via Daraz Open Platform API. Package ID: ${darazResult.packageId || "Assigned"}`,
    });

    return NextResponse.json({
      success: true,
      message: "✓ Daraz Confirmed: Order packed successfully",
      order: updatedOrder,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/pack Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to pack order." },
      { status: 500 }
    );
  }
}
