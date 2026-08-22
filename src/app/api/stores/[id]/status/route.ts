import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const storeId = params.id;

  if (!storeId) {
    return NextResponse.json({ success: false, error: "Store ID is required." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data: store, error } = await supabase
      .from("daraz_stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();

    if (error || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    const { data: creds } = await supabase
      .from("daraz_store_credentials")
      .select("access_token")
      .eq("store_id", storeId)
      .maybeSingle();

    const isConnected = Boolean(
      store.is_active &&
      (creds?.access_token || store.authorization_status === "authorized")
    );

    if (!isConnected) {
      return NextResponse.json({
        success: true,
        store: {
          id: store.id,
          store_name: store.store_name,
          seller_id: store.seller_id || "N/A",
          isConnected: false,
          status: "disconnected",
          sync_status: "disconnected",
          last_synced_at: null,
          last_sync_error: store.last_sync_error || null,
          products_count: 0,
          skus_count: 0,
          stock_count: 0,
          total_orders: 0,
          in_progress_orders: 0,
        },
      });
    }

    // Query listings & parent products
    let parentCount: number | null = null;
    try {
      const { count } = await supabase
        .from("daraz_products")
        .select("*", { count: "exact", head: true })
        .eq("store_id", storeId);
      parentCount = count;
    } catch (_) {}

    const { data: listings } = await supabase
      .from("listings")
      .select("stock_quantity, daraz_item_id")
      .eq("store_id", storeId);

    const skus_count = (listings || []).length;
    const distinctItems = new Set((listings || []).map((l: any) => l.daraz_item_id).filter(Boolean)).size;
    const products_count = (typeof parentCount === "number" && parentCount > 0)
      ? parentCount
      : (distinctItems > 0 ? distinctItems : skus_count);
    const stock_count = (listings || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

    // Query orders metrics
    const [
      { count: totalOrdersCount },
      { count: inProgressCount },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", storeId).in("status", ["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"]),
    ]);

    const updatedTime = store.updated_at ? new Date(store.updated_at).getTime() : 0;
    const isSyncing = store.sync_status === "syncing" && (Date.now() - updatedTime < 10 * 60 * 1000);
    const connectionStatus = isSyncing ? "syncing" : store.last_sync_error ? "reconnect_required" : "connected";

    return NextResponse.json({
      success: true,
      store: {
        id: store.id,
        store_code: store.store_code,
        store_name: store.store_name,
        seller_id: store.seller_id,
        region: store.region,
        slot_number: store.slot_number,
        isConnected: true,
        isSyncing,
        status: connectionStatus,
        sync_status: store.sync_status || connectionStatus,
        last_synced_at: store.last_synced_at || store.updated_at,
        last_sync_error: store.last_sync_error || null,
        products_count,
        skus_count,
        stock_count,
        total_orders: totalOrdersCount || 0,
        in_progress_orders: inProgressCount || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch store status." },
      { status: 500 }
    );
  }
}
