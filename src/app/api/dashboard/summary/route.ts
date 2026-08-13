import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    const todayStr = new Date().toISOString().split("T")[0];

    // Execute parallel lightweight count queries (head: true downloads 0 row bodies!)
    const [
      { count: totalProducts },
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
      supabase.from("listings").select("*", { count: "exact", head: true }),
      supabase.from("listings").select("*", { count: "exact", head: true }).eq("stock_quantity", 0),
      supabase.from("listings").select("*", { count: "exact", head: true }).gt("stock_quantity", 0).lte("stock_quantity", 10),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending", "unpaid"]),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready_to_ship"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "shipped"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "delivered"),
      supabase.from("daraz_stores").select("*", { count: "exact", head: true }),
      supabase.from("daraz_stores").select("*", { count: "exact", head: true }).eq("is_active", true),
      // Query only total_amount_cents for orders today
      supabase.from("orders").select("total_amount_cents").gte("order_date", todayStr),
    ]);

    const todaysRevenueCents = (todayOrdersData || []).reduce((acc: number, curr: any) => acc + (curr.total_amount_cents || 0), 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: totalProducts || 0,
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
