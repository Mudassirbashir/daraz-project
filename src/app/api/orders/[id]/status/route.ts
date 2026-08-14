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
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { status, notes } = body as { status: string; notes?: string };

    if (!status) {
      return NextResponse.json({ success: false, error: "Missing required 'status' parameter." }, { status: 400 });
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

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const store = order.daraz_stores;

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API FIRST
    // =========================================================================
    if (["ready_to_ship", "shipped", "packed"].includes(status)) {
      if (!store || !store.access_token) {
        return NextResponse.json(
          {
            success: false,
            error: "Daraz store is not connected. Reconnect store via My Stores page before executing order actions.",
          },
          { status: 400 }
        );
      }

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

      try {
        if (status === "packed") {
          const res = await darazClient.packOrder(itemIds, order.shipping_provider || "");
          if (!res.success) {
            return NextResponse.json(
              {
                success: false,
                error: "Daraz rejected packing request on Seller Center.",
                darazConfirmed: false,
              },
              { status: 400 }
            );
          }
        } else if (status === "ready_to_ship" || status === "shipped") {
          const res = await darazClient.setReadyToShip(
            itemIds,
            order.tracking_number || "",
            order.shipping_provider || ""
          );
          if (!res.success) {
            return NextResponse.json(
              {
                success: false,
                error: "Daraz rejected Ready-to-Ship action on Seller Center.",
                darazConfirmed: false,
              },
              { status: 400 }
            );
          }
        }
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
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 2 - UPDATE LOCAL DB ONLY AFTER CONFIRMED SUCCESS
    // =========================================================================
    const previousStatus = order.workflow_status || order.status;
    const timestamp = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      workflow_status: status,
      status: status === "shipped" || status === "delivered" || status === "canceled" ? status : order.status,
      updated_at: timestamp,
    };

    if (status === "packed") {
      updatePayload.is_packed = true;
      updatePayload.packed_at = timestamp;
      updatePayload.packed_by = operatorName;
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select("*, daraz_stores(id, store_name, store_code)")
      .single();

    if (updateErr) {
      throw new Error(`Database status update error: ${updateErr.message}`);
    }

    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: previousStatus,
      new_status: status,
      actor: operatorName,
      source: "Daraz API Confirmed",
      notes: notes || `Order status updated to '${status}' and confirmed via Daraz Open Platform API.`,
    });

    return NextResponse.json({
      success: true,
      message: `✓ Daraz Confirmed: Order status updated to '${status}'.`,
      order: updatedOrder,
      darazConfirmed: true,
    });
  } catch (err: any) {
    console.error("[POST /api/orders/[id]/status Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update order status." },
      { status: 500 }
    );
  }
}
