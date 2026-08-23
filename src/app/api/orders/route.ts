import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  getAuthorizedStoreIds,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "orders:read" });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const storeIdParam = searchParams.get("store_id") || searchParams.get("storeId") || "all";
  const storeId = storeIdParam;
  const city = searchParams.get("city") || "all";
  const sortBy = searchParams.get("sort_by") || "order_date";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    const supabase = createAdminClient();
    const userStoreIds = await getAuthorizedStoreIds(auth.principal);

    if (userStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        metrics: {
          totalOrders: 0, pending: 0, readyToShip: 0, shipped: 0, delivered: 0, canceled: 0, returned: 0, failed: 0, todaysOrders: 0, todaysRevenueCents: 0,
        },
        pagination: { page: 1, limit, total: 0, totalPages: 0 },
      });
    }

    let targetStoreIds = userStoreIds;
    if (storeId !== "all") {
      if (!userStoreIds.includes(storeId)) {
        return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
      }
      targetStoreIds = [storeId];
    }

    let query = supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code, region)", { count: "exact" })
      .in("store_id", targetStoreIds);

    // 2. Status Filter
    if (status !== "all") {
      if (status === "pending") {
        query = query.in("status", ["pending", "unpaid", "ready_to_ship"]);
      } else if (status === "shipped") {
        query = query.in("status", ["shipped", "in_transit"]);
      } else if (status === "delivered") {
        query = query.eq("status", "delivered");
      } else if (status === "canceled") {
        query = query.in("status", ["canceled", "returned", "failed"]);
      } else {
        query = query.eq("status", status);
      }
    }

    // 3. City Filter
    if (city !== "all") {
      query = query.ilike("customer_city", `%${city}%`);
    }

    // 4. Search Filter
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`daraz_order_id.ilike.${q},customer_name.ilike.${q},tracking_number.ilike.${q},customer_phone.ilike.${q},customer_city.ilike.${q}`);
    }

    // 5. Sorting & Range
    const validSortFields = ["order_date", "total_amount_cents", "customer_name", "status"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "order_date";

    query = query
      .order(safeSortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: ordersList, count, error } = await query;

    if (error) {
      throw new Error(`Database orders query error: ${error.message}`);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Calculate Summary Metrics for targetStoreIds in Parallel
    const [
      { count: totalOrdersCount },
      { count: pendingCount },
      { count: readyToShipCount },
      { count: shippedCount },
      { count: deliveredCount },
      { count: canceledCount },
      { count: returnedCount },
      { count: failedCount },
      { data: todayOrders },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).in("status", ["pending", "unpaid"]),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "ready_to_ship"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "shipped"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "delivered"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "canceled"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "returned"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", targetStoreIds).eq("status", "failed"),
      supabase.from("orders").select("total_amount_cents").in("store_id", targetStoreIds).gte("order_date", todayStr),
    ]);

    const todaysRevenueCents = (todayOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);

    const metrics = {
      totalOrders: totalOrdersCount || 0,
      pending: (pendingCount || 0) + (readyToShipCount || 0),
      readyToShip: readyToShipCount || 0,
      shipped: shippedCount || 0,
      delivered: deliveredCount || 0,
      canceled: canceledCount || 0,
      returned: returnedCount || 0,
      failed: failedCount || 0,
      todaysOrders: (todayOrders || []).length,
      todaysRevenueCents,
    };

    return NextResponse.json({
      success: true,
      orders: ordersList || [],
      metrics,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/orders Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch orders catalog." },
      { status: 500 }
    );
  }
}
