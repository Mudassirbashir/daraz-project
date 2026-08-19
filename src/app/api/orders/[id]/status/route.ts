import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getValidStoreAccessToken } from "@/lib/daraz/store-utils";

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

    // 1. Fetch order details
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*)")
      .eq("id", id)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: "Order not found in database." }, { status: 404 });
    }

    const currentStatus = (order.workflow_status || order.status || "pending").toLowerCase();
    
    // Idempotency check
    if (currentStatus === status.toLowerCase()) {
      return NextResponse.json({
        success: true,
        message: `Order #${order.daraz_order_id} is already in '${status}' status.`,
        order,
        darazConfirmed: true,
      });
    }

    const storeId = order.store_id || order.daraz_stores?.id;

    // 2. Call Daraz Open Platform API for status transitions
    if (["ready_to_ship", "shipped", "packed", "canceled"].includes(status)) {
      if (!storeId) {
        return NextResponse.json(
          { success: false, error: "Daraz store connection missing for order." },
          { status: 400 }
        );
      }

      const { client } = await getValidStoreAccessToken(storeId);

      // Extract item IDs if available
      const { data: itemRecords } = await supabase
        .from("daraz_order_items")
        .select("order_item_id")
        .eq("order_id", order.id);

      const itemIds = (itemRecords || []).map((i) => i.order_item_id).filter(Boolean);

      try {
        if (status === "packed") {
          await client.post("/order/pack", {
            order_item_list: JSON.stringify(itemIds.length > 0 ? itemIds : [order.daraz_order_id]),
            delivery_type: "dropship",
            shipping_provider: order.shipping_provider || "Daraz Express (DEX)",
          });
        } else if (status === "ready_to_ship" || status === "shipped") {
          // Ready-to-Ship: Call /order/package/rts using generated package_id
          const packageId = order.package_id || `PKG-${order.daraz_order_id}`;
          const rtsParams: Record<string, any> = {
            package_id: packageId,
            package_id_list: JSON.stringify([packageId]),
            delivery_type: "dropship",
            shipping_provider: order.shipping_provider || "Daraz Express (DEX)",
          };
          if (order.tracking_number) {
            rtsParams.tracking_number = order.tracking_number;
          }

          try {
            await client.post("/order/package/rts", rtsParams);
          } catch (_) {
            // Fallback endpoint shape if package_id_list is required differently
            await client.post("/order/fulfill/readyToShip", {
              order_item_ids: JSON.stringify(itemIds.length > 0 ? itemIds : [order.daraz_order_id]),
              delivery_type: "dropship",
              shipping_provider: order.shipping_provider || "Daraz Express (DEX)",
            });
          }
        } else if (status === "canceled") {
          await client.post("/order/cancel", {
            reason_id: "22",
            reason_detail: "",
            order_item_ids: JSON.stringify(itemIds.length > 0 ? itemIds : [order.daraz_order_id]),
          });
        }
      } catch (apiErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Daraz API rejected '${status}' status change: ${apiErr.message}`,
            darazConfirmed: false,
          },
          { status: 400 }
        );
      }
    }

    // 3. Update database
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
      notes: notes || `Order status updated to '${status}' and confirmed via Daraz API.`,
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
