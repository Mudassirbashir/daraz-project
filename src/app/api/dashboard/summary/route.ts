import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query authorized active store IDs
    let storeQuery = supabase
      .from("daraz_stores")
      .select("id")
      .eq("is_active", true);

    if (user?.id) {
      storeQuery = storeQuery.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data: userStores } = await storeQuery;
    const userStoreIds = (userStores || []).map((s) => s.id);

    if (userStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalProducts: 0, outOfStock: 0, lowStock: 0, totalOrders: 0, pendingOrders: 0, readyToShipOrders: 0, shippedOrders: 0, deliveredOrders: 0, todaysOrdersCount: 0, todaysRevenueCents: 0, totalStores: 0, activeStores: 0,
        },
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Execute parallel lightweight count queries scoped to userStoreIds
    const [
      { count: totalItemsCount },
      { count: totalSkusCount },
      { count: outOfStock },
      { count: lowStock },
      { count: totalOrders },
      { count: pendingOrders },
      { count: readyToShipOrders },
      { count: shippedOrders },
      { count: deliveredOrders },
      { count: totalStores },
      { count: activeStores },
      { data: todayOrdersData },
    ] = await Promise.all([
      supabase.from("daraz_products").select("*", { count: "exact", head: true }).in("store_id", userStoreIds),
      supabase.from("listings").select("*", { count: "exact", head: true }).in("store_id", userStoreIds),
      supabase.from("listings").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("stock_quantity", 0),
      supabase.from("listings").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).gt("stock_quantity", 0).lte("stock_quantity", 10),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).in("status", ["pending", "unpaid"]),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("status", "ready_to_ship"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("status", "shipped"),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("store_id", userStoreIds).eq("status", "delivered"),
      supabase.from("daraz_stores").select("*", { count: "exact", head: true }).in("id", userStoreIds),
      supabase.from("daraz_stores").select("*", { count: "exact", head: true }).in("id", userStoreIds).eq("is_active", true),
      supabase.from("orders").select("total_amount_cents").in("store_id", userStoreIds).gte("order_date", todayStr),
    ]);

    const todaysRevenueCents = (todayOrdersData || []).reduce((acc: number, curr: any) => acc + (curr.total_amount_cents || 0), 0);
    const resolvedParentItems = (typeof totalItemsCount === "number" && totalItemsCount > 0) ? totalItemsCount : (totalSkusCount || 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalItems: resolvedParentItems,
        totalSkus: totalSkusCount || 0,
        totalProducts: resolvedParentItems,
        outOfStock: outOfStock || 0,
        lowStock: lowStock || 0,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        readyToShipOrders: readyToShipOrders || 0,
        shippedOrders: shippedOrders || 0,
        deliveredOrders: deliveredOrders || 0,
        todaysOrdersCount: (todayOrdersData || []).length,
        todaysRevenueCents,
        totalStores: totalStores || 0,
        activeStores: activeStores || 0,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/dashboard/summary Exception]:", err.message);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch summary." }, { status: 500 });
  }
}
