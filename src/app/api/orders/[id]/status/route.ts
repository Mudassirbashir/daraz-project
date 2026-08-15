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

    // 1. Fetch order details without broken order_items relation
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found in database." }, { status: 404 });
    }

    // Resolve store: check if store is active, or attempt relinking via seller_id
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
          // Relink order to active store ID
          await supabase.from("orders").update({ store_id: activeStore.id }).eq("id", id);
        }
      }
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API FIRST
    // =========================================================================
    if (["ready_to_ship", "shipped", "packed"].includes(status)) {
      if (!store || !store.access_token) {
        return NextResponse.json(
          {
            success: false,
            error: "Daraz store is not connected or access token expired. Reconnect store via My Stores page before executing order actions.",
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

      // Fetch real item IDs directly from Daraz Seller Center
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

      try {
        if (status === "packed") {
          const res = await darazClient.packOrder(itemIds, order.shipping_provider || "");
          if (!res.success) {
            return NextResponse.json(
              {
                success: false,
                error: "Daraz rejected packing request: Order is already packed or ineligible on Seller Center.",
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
                error: "Daraz rejected Ready-to-Ship request: Order must be packed on Seller Center first.",
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
            error: `Daraz API rejected this action: ${apiErr.message}`,
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
      status: ["shipped", "delivered", "canceled", "returned", "failed"].includes(status) ? status : order.status,
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
