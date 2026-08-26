import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser, requireAuthorizedStore, safeErrorResponse } from "@/lib/api/auth-guard";
import { getValidStoreAccessToken } from "@/lib/daraz/store-utils";

export const dynamic = "force-dynamic";

const ALLOWED_TRANSITIONS = new Set(["ready_to_ship", "shipped", "packed", "canceled"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id || typeof id !== "string") {
    return safeErrorResponse(400, "INVALID_ID", "Order ID is required.");
  }

  const auth = await requireAuthenticatedUser(req, { permission: "orders:write" });
  if (!auth.ok) return auth.response;

  let body: { status?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return safeErrorResponse(400, "INVALID_BODY", "Invalid JSON body.");
  }

  const status = String(body?.status || "").toLowerCase();
  if (!status) {
    return safeErrorResponse(400, "MISSING_STATUS", "Missing required 'status' parameter.");
  }

  const admin = createAdminClient();
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("*, daraz_stores(id, store_name, store_code, region)")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return safeErrorResponse(404, "ORDER_NOT_FOUND", "Order not found in database.");
  }

  // Multi-store isolation: caller must own the parent store.
  const storeAuth = await requireAuthorizedStore(auth.principal, order.store_id);
  if (!storeAuth.ok) return storeAuth.response;

  // Idempotency check
  const currentStatus = (order.workflow_status || order.status || "pending").toLowerCase();
  if (currentStatus === status) {
    return NextResponse.json({
      success: true,
      message: `Order #${order.daraz_order_id} is already in '${status}' status.`,
      order,
      darazConfirmed: true,
    });
  }

  // Resolve operator display name from profiles table (server-side).
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, employee_id")
    .eq("id", auth.principal.userId)
    .maybeSingle();
  const operatorName =
    profile?.full_name || profile?.employee_id || auth.principal.email || "Team Member";

  if (ALLOWED_TRANSITIONS.has(status)) {
    const storeId = order.store_id || order.daraz_stores?.id;
    if (!storeId) {
      return safeErrorResponse(
        400,
        "STORE_NOT_FOUND",
        "Daraz store connection missing for order."
      );
    }

    const { client } = await getValidStoreAccessToken(storeId);

    const { data: itemRecords } = await admin
      .from("daraz_order_items")
      .select("order_item_id")
      .eq("order_id", order.id);
    const itemIds = (itemRecords || [])
      .map((i) => i.order_item_id)
      .filter(Boolean);

    try {
      if (status === "packed") {
        await client.post("/order/pack", {
          order_item_list: JSON.stringify(itemIds.length > 0 ? itemIds : [order.daraz_order_id]),
          delivery_type: "dropship",
          shipping_provider: order.shipping_provider || "Daraz Express (DEX)",
        });
      } else if (status === "ready_to_ship" || status === "shipped") {
        const packageId = order.package_id || `PKG-${order.daraz_order_id}`;
        const rtsParams: Record<string, any> = {
          package_id: packageId,
          package_id_list: JSON.stringify([packageId]),
          delivery_type: "dropship",
          shipping_provider: order.shipping_provider || "Daraz Express (DEX)",
        };
        if (order.tracking_number) rtsParams.tracking_number = order.tracking_number;

        try {
          await client.post("/order/package/rts", rtsParams);
        } catch {
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
          error: `Daraz API rejected '${status}' status change.`,
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
    status: ["shipped", "delivered", "canceled", "returned", "failed"].includes(status)
      ? status
      : order.status,
    updated_at: timestamp,
  };
  if (status === "packed") {
    updatePayload.is_packed = true;
    updatePayload.packed_at = timestamp;
    updatePayload.packed_by = operatorName;
  }

  const { data: updatedOrder, error: updateErr } = await admin
    .from("orders")
    .update(updatePayload)
    .eq("id", id)
    .select("*, daraz_stores(id, store_name, store_code)")
    .single();

  if (updateErr || !updatedOrder) {
    return safeErrorResponse(
      500,
      "DB_UPDATE_FAILED",
      "Failed to persist status change to database."
    );
  }

  const { error: activityErr } = await admin.from("order_activities").insert({
    order_id: order.id,
    daraz_order_id: order.daraz_order_id,
    previous_status: previousStatus,
    new_status: status,
    actor: operatorName,
    source: "Daraz API Confirmed",
    notes: body?.notes || `Order status updated to '${status}' and confirmed via Daraz API.`,
  });

  if (activityErr) {
    console.warn(`[Order Status] Activity log insert warning: ${activityErr.message}`);
  }

  return NextResponse.json({
    success: true,
    message: `✓ Daraz Confirmed: Order status updated to '${status}'.`,
    order: updatedOrder,
    darazConfirmed: true,
  });
}
