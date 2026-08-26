import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser, requireAuthorizedStore, safeErrorResponse } from "@/lib/api/auth-guard";
import { getValidStoreAccessToken } from "@/lib/daraz/store-utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id || typeof id !== "string") {
    return safeErrorResponse(400, "INVALID_ID", "Order ID is required.");
  }

  const auth = await requireAuthenticatedUser(req, { permission: "orders:pack" });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: order, error: fetchErr } = await admin
    .from("orders")
    .select("*, daraz_stores(*)")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return safeErrorResponse(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  const storeAuth = await requireAuthorizedStore(auth.principal, order.store_id);
  if (!storeAuth.ok) return storeAuth.response;

  const storeId = order.store_id || order.daraz_stores?.id;
  if (!storeId) {
    return safeErrorResponse(
      400,
      "STORE_NOT_FOUND",
      "Order is not associated with a valid store."
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, employee_id")
    .eq("id", auth.principal.userId)
    .maybeSingle();
  const operatorName =
    profile?.full_name || profile?.employee_id || auth.principal.email || "Team Member";

  const { data: itemRecords } = await admin
    .from("daraz_order_items")
    .select("order_item_id")
    .eq("order_id", order.id);
  let itemIds: string[] = (itemRecords || [])
    .map((i) => i.order_item_id)
    .filter(Boolean);

  if (itemIds.length === 0 && order.daraz_order_id) {
    itemIds = [order.daraz_order_id];
  }

  if (itemIds.length === 0) {
    return safeErrorResponse(
      400,
      "NO_ORDER_ITEMS",
      "No valid order item IDs found for order."
    );
  }

  let packRes: any;
  try {
    const { client } = await getValidStoreAccessToken(storeId);
    const shippingProvider = order.shipping_provider || "Daraz Express (DEX)";
    try {
      packRes = await client.post("/order/pack", {
        order_item_list: JSON.stringify(itemIds),
        delivery_type: "dropship",
        shipping_provider: shippingProvider,
      });
    } catch {
      packRes = await client.post("/order/fulfill/pack", {
        order_item_list: JSON.stringify(itemIds),
        delivery_type: "dropship",
        shipping_provider: shippingProvider,
      });
    }
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Daraz API rejected order packing request.",
        darazConfirmed: false,
      },
      { status: 400 }
    );
  }

  const dataObj = packRes?.data || packRes?.result || packRes || {};
  let packageId: string | undefined;
  if (Array.isArray(dataObj?.packages) && dataObj.packages.length > 0) {
    packageId = String(dataObj.packages[0].package_id || dataObj.packages[0].packageId || "");
  } else if (dataObj?.package_id || dataObj?.packageId) {
    packageId = String(dataObj.package_id || dataObj.packageId);
  }

  const packageIdToStore = packageId || order.package_id || `PKG-${order.daraz_order_id}`;
  const timestamp = new Date().toISOString();

  const { data: updatedOrder, error: updateErr } = await admin
    .from("orders")
    .update({
      is_packed: true,
      packed_at: timestamp,
      packed_by: operatorName,
      workflow_status: "ready_to_ship",
      package_id: packageIdToStore,
      updated_at: timestamp,
    })
    .eq("id", id)
    .select("*, daraz_stores(id, store_name, store_code)")
    .single();

  if (updateErr || !updatedOrder) {
    return safeErrorResponse(
      500,
      "DB_UPDATE_FAILED",
      "Failed to persist packing status to database."
    );
  }

  const { error: pkgErr } = await admin.from("daraz_packages").upsert({
    order_id: order.id,
    daraz_order_id: order.daraz_order_id,
    package_id: packageIdToStore,
    tracking_number: order.tracking_number || null,
    shipment_provider: order.shipping_provider || "Daraz Express (DEX)",
    package_status: "packed",
    item_ids: itemIds,
    updated_at: timestamp,
  });
  if (pkgErr) {
    console.warn(`[Order Pack] Package upsert warning: ${pkgErr.message}`);
  }

  const { error: actErr } = await admin.from("order_activities").insert({
    order_id: order.id,
    daraz_order_id: order.daraz_order_id,
    previous_status: order.workflow_status || order.status,
    new_status: "ready_to_ship",
    actor: operatorName,
    source: "Daraz API Confirmed",
    notes: `Order packed via Daraz API. Package ID: ${packageIdToStore}`,
  });
  if (actErr) {
    console.warn(`[Order Pack] Activity log warning: ${actErr.message}`);
  }

  return NextResponse.json({
    success: true,
    message: "✓ Daraz Confirmed: Order packed successfully",
    packageId: packageIdToStore,
    order: updatedOrder,
    darazConfirmed: true,
  });
}
