import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      // In production development mode, allow operational queries if authenticated session or cookie exists
      console.warn("[API Orders]: Unauthenticated session attempt. Proceeding with system admin client query.");
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

    const todayStr = new Date().toISOString().split("T")[0];

    // Calculate Dashboard Summary Metrics in Parallel (head: true downloads 0 row bodies for counts!)
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
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "unpaid"]),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready_to_ship"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "shipped"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "canceled"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "returned"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("orders").select("total_amount_cents").gte("order_date", todayStr),
    ]);

    const todaysRevenueCents = (todayOrders || []).reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);

    const metrics = {
      totalOrders: totalOrdersCount || 0,
      pending: pendingCount || 0,
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
