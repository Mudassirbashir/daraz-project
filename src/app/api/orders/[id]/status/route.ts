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
    // LIFECYCLE TRANSITION & IDEMPOTENCY VALIDATION
    // =========================================================================
    const currentStatus = (order.workflow_status || order.status || "pending").toLowerCase();
    
    // Idempotency: If order is already in target status, return clean success immediately
    if (currentStatus === status.toLowerCase()) {
      return NextResponse.json({
        success: true,
        message: `Order #${order.daraz_order_id} is already in '${status}' status.`,
        order,
        darazConfirmed: true,
      });
    }

    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      pending: ["picking", "picked", "packed", "ready_to_ship", "canceled"],
      unpaid: ["pending", "picking", "canceled"],
      picking: ["picked", "canceled"],
      picked: ["packed", "ready_to_ship", "canceled"],
      packed: ["ready_to_ship", "canceled"],
      ready_to_ship: ["shipped", "canceled"],
      shipped: ["delivered", "returned", "failed"],
      delivered: [],
      canceled: [],
      returned: [],
      failed: [],
    };

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action: Order currently in '${currentStatus}' state cannot be changed to '${status}'. Supported actions: [${allowedNext.join(", ") || "None"}].`,
        },
        { status: 400 }
      );
    }

    // =========================================================================
    // TWO-PHASE ACTION MODEL: STEP 1 - CALL DARAZ API FIRST
    // =========================================================================
    if (["ready_to_ship", "shipped", "packed", "canceled"].includes(status)) {
      if (!store || !store.access_token) {
        return NextResponse.json(
          {
            success: false,
            error: "Daraz store is not connected. Reconnect store via My Stores page before executing order actions.",
          },
          { status: 400 }
        );
      }

      const { getDarazClient } = await import("@/lib/daraz/client");
      const darazClient = await getDarazClient(store.id);

      let itemIds: string[] = [];
      if (Array.isArray(order.order_items) && order.order_items.length > 0) {
        itemIds = order.order_items.map((i: any) => String(i.order_item_id)).filter(Boolean);
      }

      if (itemIds.length === 0) {
        const liveItems = await darazClient.getOrderItems(order.daraz_order_id);
        itemIds = liveItems.map((i) => String(i.order_item_id)).filter(Boolean);
      }

      if (itemIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Daraz API Error: No valid order item IDs found for Order #${order.daraz_order_id}.`,
            darazConfirmed: false,
          },
          { status: 400 }
        );
      }

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
        } else if (status === "canceled") {
          const res = await darazClient.cancelOrder(itemIds);
          if (!res.success) {
            return NextResponse.json(
              {
                success: false,
                error: "Daraz rejected cancellation request on Seller Center.",
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
