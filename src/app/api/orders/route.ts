import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const storeId = searchParams.get("store_id") || "all";
  const city = searchParams.get("city") || "all";
  const sortBy = searchParams.get("sort_by") || "order_date";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("orders")
      .select("*, daraz_stores(store_name, store_code, region)", { count: "exact" });

    // 1. Store Filter
    if (storeId !== "all") {
      query = query.eq("store_id", storeId);
    }

    // 2. Status Filter
    if (status !== "all") {
      if (status === "pending") {
        query = query.in("status", ["pending", "unpaid"]);
      } else if (status === "delivered") {
        query = query.in("status", ["delivered", "shipped"]);
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
      query = query.or(`daraz_order_id.ilike.${q},customer_name.ilike.${q},tracking_number.ilike.${q}`);
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

    // Calculate Dashboard Summary Metrics Across All Orders
    const { data: allOrdersForMetrics } = await supabase
      .from("orders")
      .select("id, status, total_amount_cents, order_date");

    const metrics = {
      totalOrders: allOrdersForMetrics?.length || 0,
      pending: 0,
      readyToShip: 0,
      shipped: 0,
      delivered: 0,
      canceled: 0,
      returned: 0,
      failed: 0,
      todaysOrders: 0,
      todaysRevenueCents: 0,
    };

    const todayStr = new Date().toISOString().split("T")[0];

    (allOrdersForMetrics || []).forEach((ord: any) => {
      const st = (ord.status || "").toLowerCase();
      if (["pending", "unpaid"].includes(st)) metrics.pending++;
      if (st === "ready_to_ship") metrics.readyToShip++;
      if (st === "shipped") metrics.shipped++;
      if (st === "delivered") metrics.delivered++;
      if (st === "canceled") metrics.canceled++;
      if (st === "returned") metrics.returned++;
      if (st === "failed") metrics.failed++;

      if (ord.order_date && ord.order_date.startsWith(todayStr)) {
        metrics.todaysOrders++;
        metrics.todaysRevenueCents += ord.total_amount_cents || 0;
      }
    });

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
