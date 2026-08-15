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
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    let operatorName = "Team Member (Ops Manager)";
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, employee_id")
        .eq("id", user.id)
        .maybeSingle();

      operatorName = profile?.full_name || profile?.employee_id || user.email || operatorName;
    }

    // Fetch order & store credentials
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    let store = order.daraz_stores;
    if (!store || !store.is_active || !store.access_token) {
      if (store?.seller_id) {
        const { data: activeStore } = await supabase
          .from("daraz_stores")
          .select("*")
          .eq("seller_id", store.seller_id)
          .eq("is_active", true)
          .not("access_token", "is", null)
          .maybeSingle();

        if (activeStore) {
          store = activeStore;
          await supabase.from("orders").update({ store_id: activeStore.id }).eq("id", id);
        }
      }
    }

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
    const { getDarazClient } = await import("@/lib/daraz/client");
    const darazClient = await getDarazClient(store.id);

    let itemIds: string[] = [];
    try {
      const liveItems = await darazClient.getOrderItems(order.daraz_order_id);
      itemIds = liveItems.map((item) => item.order_item_id);
    } catch (e) {
      // Fallback
    }

    if (itemIds.length === 0) {
      itemIds = [order.daraz_order_id];
    }

    let darazResult;
    try {
      darazResult = await darazClient.packOrder(itemIds, order.shipping_provider || "");
    } catch (apiErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz API rejected packing action: ${apiErr.message}`,
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
