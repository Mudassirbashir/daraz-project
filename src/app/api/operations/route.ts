import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const stage = searchParams.get("stage") || "all";
  const barcode = searchParams.get("barcode") || "";

  const offset = (page - 1) * limit;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query authorized active store IDs
    let storeQuery = supabase
      .from("daraz_stores")
      .select("id")
      .eq("is_active", true)
      .not("access_token", "is", null);

    if (user?.id) {
      storeQuery = storeQuery.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data: userStores } = await storeQuery;
    const userStoreIds = (userStores || []).map((s) => s.id);

    if (userStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        metrics: {
          ordersWaiting: 0,
          ordersPicked: 0,
          ordersPacked: 0,
          ordersShipped: 0,
          avgProcessingTimeMinutes: 0,
        },
        pagination: { page: 1, limit, total: 0, totalPages: 0 },
      });
    }

    let query = supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code, region)", { count: "exact" })
      .in("store_id", userStoreIds);

    if (stage !== "all") {
      if (stage === "new") query = query.in("status", ["pending", "unpaid"]);
      else if (stage === "ready_to_pick" || stage === "picking") query = query.eq("status", "pending");
      else if (stage === "ready_to_pack" || stage === "packing") query = query.eq("status", "ready_to_ship");
      else if (stage === "ready_to_ship" || stage === "shipped") query = query.in("status", ["ready_to_ship", "shipped"]);
      else if (stage === "delivered") query = query.eq("status", "delivered");
      else if (stage === "canceled" || stage === "returned") query = query.in("status", ["canceled", "returned", "failed"]);
    }

    const searchTerm = barcode.trim() || search.trim();
    if (searchTerm) {
      const q = `%${searchTerm}%`;
      query = query.or(`daraz_order_id.ilike.${q},customer_name.ilike.${q},tracking_number.ilike.${q}`);
    }

    query = query.order("order_date", { ascending: false }).range(offset, offset + limit - 1);

    const { data: rawOrders, count, error } = await query;

    if (error) {
      throw new Error(`Database orders query error: ${error.message}`);
    }

    const [
      { count: waitingCount },
      { count: pickedCount },
      { count: packedCount },
      { count: shippedCount },
      completedOrdersRes,
      inventoryListRes,
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).in("status", ["pending", "unpaid"]).eq("is_packed", false),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("workflow_status", "picked"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("is_packed", true),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).in("status", ["shipped", "delivered"]),
      supabase.from("orders").select("order_date, updated_at").in("store_id", userStoreIds).eq("is_packed", true).order("updated_at", { ascending: false }).limit(50),
      supabase.from("inventory").select("sku, storage_location").limit(100),
    ]);

    const inventoryMap: Record<string, string> = {};
    (inventoryListRes.data || []).forEach((inv) => {
      inventoryMap[inv.sku] = inv.storage_location || "N/A";
    });

    const enrichedOrders = (rawOrders || []).map((ord) => ({
      ...ord,
      shelf_location: inventoryMap[ord.daraz_order_id] || "N/A",
      package_status: ord.status === "shipped" ? "In Transit" : ord.status === "delivered" ? "Delivered" : "Processing",
    }));

    let avgProcessingTimeMinutes = 0;
    if (completedOrdersRes.data && completedOrdersRes.data.length > 0) {
      const totalDiffMs = completedOrdersRes.data.reduce((sum, ord) => {
        const start = new Date(ord.order_date).getTime();
        const end = new Date(ord.updated_at).getTime();
        return sum + Math.max(0, end - start);
      }, 0);
      avgProcessingTimeMinutes = Math.round((totalDiffMs / completedOrdersRes.data.length / (60 * 1000)) * 10) / 10;
    }

    const metrics = {
      ordersWaiting: waitingCount || 0,
      ordersPicked: pickedCount || 0,
      ordersPacked: packedCount || 0,
      ordersShipped: shippedCount || 0,
      avgProcessingTimeMinutes,
    };

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      metrics,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/operations Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch warehouse operations." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { ids, action, targetStatus } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "Order IDs array (ids) required." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch target orders with store info
    const { data: ordersToProcess, error: fetchErr } = await supabase
      .from("orders")
      .select("*, daraz_stores(*), order_items(*)")
      .in("id", ids);

    if (fetchErr || !ordersToProcess || ordersToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Target orders not found." }, { status: 404 });
    }

    const confirmedIds: string[] = [];
    const rejectedErrors: string[] = [];

    // Process each order through Daraz API first (Two-Phase Model)
    for (const order of ordersToProcess) {
      const store = order.daraz_stores;
      if (!store || !store.access_token) {
        rejectedErrors.push(`Order #${order.daraz_order_id}: Store disconnected.`);
        continue;
      }

      try {
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

        if (action === "pack" || targetStatus === "ready_to_ship") {
          const res = await darazClient.packOrder(itemIds, order.shipping_provider || "");
          if (res.success) confirmedIds.push(order.id);
          else rejectedErrors.push(`Order #${order.daraz_order_id}: Daraz rejected packing.`);
        } else if (action === "ship" || targetStatus === "shipped") {
          const res = await darazClient.setReadyToShip(itemIds, order.tracking_number || "", order.shipping_provider || "");
          if (res.success) confirmedIds.push(order.id);
          else rejectedErrors.push(`Order #${order.daraz_order_id}: Daraz rejected RTS/shipping.`);
        } else {
          confirmedIds.push(order.id);
        }
      } catch (apiErr: any) {
        rejectedErrors.push(`Order #${order.daraz_order_id}: ${apiErr.message}`);
      }
    }

    if (confirmedIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Daraz rejected bulk operation. Reasons: ${rejectedErrors.join("; ")}`,
          confirmedCount: 0,
        },
        { status: 400 }
      );
    }

    const updateStatus = targetStatus || (action === "ship" ? "shipped" : action === "pack" ? "ready_to_ship" : "pending");

    const { data: updated, error } = await supabase
      .from("orders")
      .update({
        status: updateStatus,
        workflow_status: updateStatus,
        is_packed: action === "pack" ? true : undefined,
        updated_at: new Date().toISOString(),
      })
      .in("id", confirmedIds)
      .select();

    if (error) {
      throw new Error(`Bulk database update failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Daraz Confirmed: Bulk Action '${action}' applied to ${updated?.length || 0} order(s).`,
      count: updated?.length || 0,
      rejectedErrors,
    });
  } catch (err: any) {
    console.error("[PATCH /api/operations Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute WMS operation." },
      { status: 500 }
    );
  }
}
