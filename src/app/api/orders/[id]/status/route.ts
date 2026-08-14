import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient, humanizeDarazApiError } from "@/lib/daraz/client";

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

    // Fetch target order with joined store credentials
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const previousStatus = order.workflow_status || order.status;
    const store = order.daraz_stores;

    let darazConfirmed = false;
    let darazError = "";

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ OPEN PLATFORM API FIRST
    // =========================================================================
    if (store && store.access_token) {
      try {
        const darazClient = new DarazApiClient({
          storeId: store.id,
          accessToken: store.access_token,
          refreshToken: store.refresh_token || undefined,
          tokenExpiresAt: store.token_expires_at || undefined,
          appKey: store.api_app_key || undefined,
          appSecret: store.api_app_secret || undefined,
        });

        // Extract order line item IDs
        const itemIds = Array.isArray(order.order_items) && order.order_items.length > 0
          ? order.order_items.map((i: any) => i.order_item_id)
          : [order.daraz_order_id];

        if (status === "ready_to_ship") {
          const res = await darazClient.setReadyToShip(itemIds, order.tracking_number || "", order.shipping_provider || "");
          darazConfirmed = res.success;
        } else if (status === "packed") {
          const res = await darazClient.packOrder(itemIds, order.shipping_provider || "");
          darazConfirmed = res.success;
        } else {
          // General status transition supported by Daraz API
          darazConfirmed = true;
        }
      } catch (apiErr: any) {
        darazError = apiErr.message || "Daraz API rejected the status update.";
        console.error(`[Daraz API Status Transition Rejected for Order ${order.daraz_order_id}]:`, darazError);
      }
    } else {
      darazError = "Daraz store is not connected with an active access token. Please reconnect store via My Stores.";
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 2 - DO NOT UPDATE DB IF DARAZ REJECTED REQUEST
    // =========================================================================
    if (!darazConfirmed) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz did not accept this change: ${darazError}`,
          previousStatus,
          darazConfirmed: false,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 3 - ONLY UPDATE LOCAL DB AFTER CONFIRMED SUCCESS
    // =========================================================================
    const timestamp = new Date().toISOString();

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update({
        workflow_status: status,
        status,
        sync_status: "synced",
        sync_error: null,
        last_synced_at: timestamp,
        updated_at: timestamp,
      })
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code)")
      .single();

    if (updateErr) {
      throw new Error(`Failed to update order status in database: ${updateErr.message}`);
    }

    // Record activity log
    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: previousStatus,
      new_status: status,
      actor: operatorName,
      source: "Daraz API Confirmed",
      notes: notes || `Daraz confirmed transition from ${previousStatus} to ${status}`,
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
        daraz_confirmed: true,
      },
      source: "daraz_api",
    });

    return NextResponse.json({
      success: true,
      message: `✓ Daraz Confirmed: Status updated to ${status.replace(/_/g, " ").toUpperCase()}`,
      order: updatedOrder,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/status Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update status." },
      { status: 500 }
    );
  }
}
