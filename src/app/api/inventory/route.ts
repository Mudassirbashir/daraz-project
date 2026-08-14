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
  const stockStatus = searchParams.get("stock_status") || "all";
  const storeId = searchParams.get("store_id") || "all";
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("inventory")
      .select("*, listings(store_id, daraz_item_id, daraz_sku_id, title, price_cents, special_price_cents, is_synced, last_synced_at, daraz_stores(id, store_name, store_code, region))", { count: "exact" });

    // 1. Filter by Stock Status
    if (stockStatus === "out_of_stock") {
      query = query.eq("quantity_on_hand", 0);
    } else if (stockStatus === "low_stock") {
      query = query.gt("quantity_on_hand", 0).lte("quantity_on_hand", 10);
    } else if (stockStatus === "in_stock") {
      query = query.gt("quantity_on_hand", 0);
    }

    // 2. Filter by Search
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`sku.ilike.${q},title.ilike.${q},storage_location.ilike.${q}`);
    }

    // 3. Sorting & Pagination Range
    const validSortFields = ["created_at", "title", "sku", "quantity_on_hand"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";

    query = query
      .order(safeSortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: rawInventory, count, error } = await query;

    if (error) {
      throw new Error(`Database inventory query error: ${error.message}`);
    }

    // Filter by store_id post-fetch if storeId specified
    let filteredInventory = rawInventory || [];
    if (storeId !== "all") {
      filteredInventory = filteredInventory.filter((item: any) =>
        item.listings?.some((l: any) => l.store_id === storeId)
      );
    }

    // Calculate Centralized Dashboard Metrics
    const { data: allItems } = await supabase
      .from("inventory")
      .select("quantity_on_hand, quantity_reserved, reorder_point, updated_at");

    const metrics = {
      totalProducts: allItems?.length || 0,
      totalAvailableStock: 0,
      totalReservedStock: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      recentlyUpdatedCount: 0,
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    (allItems || []).forEach((item: any) => {
      const qty = item.quantity_on_hand || 0;
      const rsv = item.quantity_reserved || 0;
      const threshold = item.reorder_point || 10;

      metrics.totalAvailableStock += qty;
      metrics.totalReservedStock += rsv;

      if (qty === 0) {
        metrics.outOfStockProducts++;
      } else if (qty <= threshold) {
        metrics.lowStockProducts++;
      }

      if (item.updated_at && item.updated_at >= oneDayAgo) {
        metrics.recentlyUpdatedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      inventory: filteredInventory,
      metrics,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/inventory Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch inventory catalog." },
      { status: 500 }
    );
  }
}
