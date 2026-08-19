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
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }

    const storeId = order.store_id || order.daraz_stores?.id;
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Order is not associated with a valid store." }, { status: 400 });
    }

    // 2. Extract daraz_order_item_ids from the database
    const { data: itemRecords } = await supabase
      .from("daraz_order_items")
      .select("order_item_id")
      .eq("order_id", order.id);

    let itemIds: string[] = (itemRecords || []).map((i) => i.order_item_id).filter(Boolean);

    if (itemIds.length === 0 && order.daraz_order_id) {
      itemIds = [order.daraz_order_id];
    }

    if (itemIds.length === 0) {
      return NextResponse.json({ success: false, error: "No valid order item IDs found for order." }, { status: 400 });
    }

    // 3. Obtain client with auto-refreshed access token
    const { client } = await getValidStoreAccessToken(storeId);
    const shippingProvider = order.shipping_provider || "Daraz Express (DEX)";

    // 4. Call /order/pack passing order_item_list: JSON.stringify(ids), delivery_type: 'dropship', and shipping_provider
    let packRes: any;
    try {
      packRes = await client.post("/order/pack", {
        order_item_list: JSON.stringify(itemIds),
        delivery_type: "dropship",
        shipping_provider: shippingProvider,
      });
    } catch (apiErr: any) {
      // Try fallback route /order/fulfill/pack if /order/pack returns 404
      try {
        packRes = await client.post("/order/fulfill/pack", {
          order_item_list: JSON.stringify(itemIds),
          delivery_type: "dropship",
          shipping_provider: shippingProvider,
        });
      } catch (fallbackErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: `Daraz API rejected order packing: ${apiErr.message}`,
            darazConfirmed: false,
          },
          { status: 400 }
        );
      }
    }

    // 5. Extract returned package_id
    const dataObj = packRes?.data || packRes?.result || packRes || {};
    let packageId: string | undefined;

    if (Array.isArray(dataObj?.packages) && dataObj.packages.length > 0) {
      packageId = String(dataObj.packages[0].package_id || dataObj.packages[0].packageId || "");
    } else if (dataObj?.package_id || dataObj?.packageId) {
      packageId = String(dataObj.package_id || dataObj.packageId);
    }

    const packageIdToStore = packageId || order.package_id || `PKG-${order.daraz_order_id}`;
    const timestamp = new Date().toISOString();

    // 6. Update database with confirmed package_id
    const { data: updatedOrder, error: updateErr } = await supabase
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

    if (updateErr) {
      throw new Error(`Failed to update packing status in database: ${updateErr.message}`);
    }

    // Record in daraz_packages table
    try {
      await supabase.from("daraz_packages").upsert({
        order_id: order.id,
        daraz_order_id: order.daraz_order_id,
        package_id: packageIdToStore,
        tracking_number: order.tracking_number || null,
        shipment_provider: shippingProvider,
        package_status: "packed",
        item_ids: itemIds,
        updated_at: timestamp,
      });
    } catch (_) {}

    await supabase.from("order_activities").insert({
      order_id: order.id,
      daraz_order_id: order.daraz_order_id,
      previous_status: order.workflow_status || order.status,
      new_status: "ready_to_ship",
      actor: operatorName,
      source: "Daraz API Confirmed",
      notes: `Order packed via Daraz API. Package ID: ${packageIdToStore}`,
    });

    return NextResponse.json({
      success: true,
      message: "✓ Daraz Confirmed: Order packed successfully",
      packageId: packageIdToStore,
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
