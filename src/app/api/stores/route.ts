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

    // 1. Fetch user-scoped configured stores (or system stores if user_id is null)
    const { data: stores, error: storesErr } = await supabase
      .from("daraz_stores")
      .select("id, store_code, store_name, region, seller_id, is_active, token_expires_at, updated_at, created_at, access_token")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: true });

    if (storesErr) {
      throw new Error(`Failed to fetch stores: ${storesErr.message}`);
    }

    const storesList = stores || [];

    // 2. Compute live metrics for connected stores
    const enrichedStores = await Promise.all(
      storesList.map(async (store) => {
        const isConnected = Boolean(store.access_token && store.access_token.trim());

        if (!isConnected) {
          return {
            id: store.id,
            store_code: store.store_code,
            store_name: store.store_name,
            seller_id: store.seller_id || "N/A",
            region: store.region || "PK",
            isConnected: false,
            status: "not_connected",
            statusText: "Not Connected",
            statusBadgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
            last_synced_at: null,
            products_count: 0,
            stock_count: 0,
            total_orders: 0,
            in_progress_orders: 0,
            completed_orders: 0,
          };
        }

        // Query listings count & stock sum
        const { data: listings } = await supabase
          .from("listings")
          .select("stock_quantity")
          .eq("store_id", store.id);

        const products_count = (listings || []).length;
        const stock_count = (listings || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

        // Query orders metrics
        const { data: orders } = await supabase
          .from("orders")
          .select("status")
          .eq("store_id", store.id);

        const total_orders = (orders || []).length;
        const in_progress_orders = (orders || []).filter((o) =>
          ["pending", "unpaid", "ready_to_ship", "shipped"].includes(o.status)
        ).length;
        const completed_orders = (orders || []).filter((o) => o.status === "delivered").length;

        // Query last synced time from API logs or store updated_at
        const { data: lastLog } = await supabase
          .from("daraz_api_logs")
          .select("created_at")
          .eq("store_id", store.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const last_synced_at = lastLog?.created_at || store.updated_at || null;

        return {
          id: store.id,
          store_code: store.store_code,
          store_name: store.store_name,
          seller_id: store.seller_id || "SELLER_UNKNOWN",
          region: store.region || "PK",
          isConnected: true,
          status: "connected",
          statusText: "Connected & Synced",
          statusBadgeClass: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          last_synced_at,
          products_count,
          stock_count,
          total_orders,
          in_progress_orders,
          completed_orders,
        };
      })
    );

    const connectedStoresCount = enrichedStores.filter((s) => s.isConnected).length;
    const disconnectedStoresCount = enrichedStores.filter((s) => !s.isConnected).length;

    return NextResponse.json({
      success: true,
      stores: enrichedStores,
      summary: {
        total_stores: enrichedStores.length,
        connected_stores: connectedStoresCount,
        disconnected_stores: disconnectedStoresCount,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/stores Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stores overview." },
      { status: 500 }
    );
  }
}
