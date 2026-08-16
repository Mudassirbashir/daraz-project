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

    // Fetch user-scoped configured real stores
    let storesList: any[] = [];
    try {
      const { data, error } = await supabase
        .from("daraz_stores")
        .select("id, store_code, store_name, region, seller_id, is_active, token_expires_at, updated_at, created_at, access_token, sync_status, last_synced_at, slot_number, last_sync_error")
        .or(user?.id ? `user_id.eq.${user.id},user_id.is.null` : "user_id.is.null")
        .order("created_at", { ascending: true });

      if (error) {
        // Multi-tier fallback 1: Exclude slot_number
        const { data: fb1, error: fb1Err } = await supabase
          .from("daraz_stores")
          .select("id, store_code, store_name, region, seller_id, is_active, token_expires_at, updated_at, created_at, access_token, sync_status, last_synced_at, last_sync_error")
          .or(user?.id ? `user_id.eq.${user.id},user_id.is.null` : "user_id.is.null")
          .order("created_at", { ascending: true });

        if (fb1Err) {
          // Multi-tier fallback 2: Base production columns baseline
          const { data: fb2, error: fb2Err } = await supabase
            .from("daraz_stores")
            .select("id, store_code, store_name, region, seller_id, is_active, token_expires_at, updated_at, created_at, access_token, sync_status")
            .or(user?.id ? `user_id.eq.${user.id},user_id.is.null` : "user_id.is.null")
            .order("created_at", { ascending: true });

          if (fb2Err) throw new Error(`Failed to fetch stores: ${fb2Err.message}`);
          storesList = fb2 || [];
        } else {
          storesList = fb1 || [];
        }
      } else {
        storesList = data || [];
      }
    } catch (err: any) {
      throw new Error(`Failed to fetch stores: ${err.message}`);
    }

    // Compute live metrics for connected stores
    const enrichedStores = await Promise.all(
      storesList.map(async (store) => {
        const isConnected = Boolean(store.access_token && store.access_token.trim() && store.is_active);

        if (!isConnected) {
          return {
            id: store.id,
            store_code: store.store_code,
            store_name: store.store_name,
            seller_id: store.seller_id || "N/A",
            region: store.region || "PK",
            slot_number: store.slot_number || null,
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

        // Query parent items & SKUs metrics
        const { count: parentItemsCount } = await supabase
          .from("daraz_products")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);

        const { data: listings } = await supabase
          .from("listings")
          .select("stock_quantity")
          .eq("store_id", store.id);

        const skus_count = (listings || []).length;
        const products_count = (typeof parentItemsCount === "number" && parentItemsCount > 0) ? parentItemsCount : skus_count;
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

        const last_synced_at = store.last_synced_at || lastLog?.created_at || store.updated_at || null;
        const syncStatus = store.sync_status || (products_count > 0 ? "success" : "idle");

        return {
          id: store.id,
          store_code: store.store_code,
          store_name: store.store_name,
          seller_id: store.seller_id || "SELLER_UNKNOWN",
          region: store.region || "PK",
          slot_number: store.slot_number || null,
          isConnected: true,
          status: syncStatus === "syncing" ? "syncing" : syncStatus === "error" ? "error" : "connected",
          sync_status: syncStatus,
          statusText: syncStatus === "syncing" ? "Syncing..." : syncStatus === "error" ? "Sync Error" : "Connected",
          statusBadgeClass:
            syncStatus === "syncing"
              ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
              : syncStatus === "error"
              ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
          last_synced_at,
          items_count: products_count,
          skus_count,
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

export async function POST(req: NextRequest) {
  try {
    const { store_id } = await req.json().catch(() => ({ store_id: null }));

    if (!store_id) {
      return NextResponse.json({ success: false, error: "Missing required 'store_id' parameter." }, { status: 400 });
    }

    const { executeDarazSync } = await import("@/lib/daraz/sync-service");
    const result = await executeDarazSync(store_id);

    return NextResponse.json({
      success: result.success,
      message: result.success ? `Successfully synced store products & orders.` : "Sync completed with warnings.",
      result,
    });
  } catch (err: any) {
    console.error("[POST /api/stores Exception]:", err.message);
    return NextResponse.json({ success: false, error: err.message || "Failed to sync store." }, { status: 500 });
  }
}
