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
  const storeIdParam = searchParams.get("store_id") || searchParams.get("storeId") || "all";
  const storeId = storeIdParam;
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
        inventory: [],
        metrics: {
          totalProducts: 0,
          totalAvailableStock: 0,
          totalReservedStock: 0,
          lowStockProducts: 0,
          outOfStockProducts: 0,
          recentlyUpdatedCount: 0,
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

    // Query listings as the authoritative store-isolated stock ledger
    let query = supabase
      .from("listings")
      .select("*, inventory(quantity_reserved, storage_location), daraz_stores(id, store_name, store_code, region, seller_id)", { count: "exact" })
      .in("store_id", targetStoreIds);

    // 1. Filter by Stock Status
    if (stockStatus === "out_of_stock") {
      query = query.eq("stock_quantity", 0);
    } else if (stockStatus === "low_stock") {
      query = query.gt("stock_quantity", 0).lte("stock_quantity", 10);
    } else if (stockStatus === "in_stock") {
      query = query.gt("stock_quantity", 0);
    }

    // 2. Filter by Search
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`seller_sku.ilike.${q},title.ilike.${q},daraz_item_id.ilike.${q}`);
    }

    // 3. Sorting & Pagination Range
    const validSortFields = ["created_at", "title", "seller_sku", "stock_quantity"];
    const safeSortBy = sortBy === "sku" ? "seller_sku" : sortBy === "quantity_on_hand" ? "stock_quantity" : validSortFields.includes(sortBy) ? sortBy : "created_at";

    query = query
      .order(safeSortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: listings, count, error } = await query;

    if (error) {
      throw new Error(`Database stock listings query error: ${error.message}`);
    }

    // Map listings to standard inventory shape expected by frontend UI
    const formattedInventory = (listings || []).map((l: any) => {
      const invData = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory;
      const reserved = invData?.quantity_reserved || 0;
      const location = invData?.storage_location || "Main Warehouse";

      return {
        id: l.id,
        sku: l.seller_sku,
        title: l.title,
        quantity_on_hand: l.stock_quantity || 0,
        quantity_reserved: reserved,
        storage_location: location,
        price_cents: l.price_cents,
        special_price_cents: l.special_price_cents,
        daraz_item_id: l.daraz_item_id,
        daraz_sku_id: l.daraz_sku_id,
        store_id: l.store_id,
        store_name: l.daraz_stores?.store_name || "Daraz Store",
        store_code: l.daraz_stores?.store_code || "STORE",
        seller_id: l.daraz_stores?.seller_id || "N/A",
        is_synced: l.is_synced,
        last_synced_at: l.last_synced_at,
        updated_at: l.updated_at,
      };
    });

    // Calculate Centralized Stock Metrics scoped strictly to targetStoreIds
    const { data: allListings } = await supabase
      .from("listings")
      .select("stock_quantity, daraz_item_id, updated_at")
      .in("store_id", targetStoreIds);

    const distinctParentItems = new Set((allListings || []).map((l: any) => l.daraz_item_id).filter(Boolean)).size;
    const totalProductsCount = distinctParentItems > 0 ? distinctParentItems : (allListings || []).length;

    const metrics = {
      totalProducts: totalProductsCount,
      totalAvailableStock: 0,
      totalReservedStock: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      recentlyUpdatedCount: 0,
    };

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    (allListings || []).forEach((item: any) => {
      const qty = item.stock_quantity || 0;
      metrics.totalAvailableStock += qty;

      if (qty === 0) {
        metrics.outOfStockProducts++;
      } else if (qty <= 10) {
        metrics.lowStockProducts++;
      }

      if (item.updated_at && item.updated_at >= oneDayAgo) {
        metrics.recentlyUpdatedCount++;
      }
    });

    return NextResponse.json({
      success: true,
      inventory: formattedInventory,
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
