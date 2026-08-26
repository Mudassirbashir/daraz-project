import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  getAuthorizedStoreIds,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "listings:read" });
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);

  const pageInput = parseInt(searchParams.get("page") || "1", 10);
  const limitInput = parseInt(searchParams.get("limit") || "25", 10);
  const page = isNaN(pageInput) || pageInput < 1 ? 1 : pageInput;
  const limit = isNaN(limitInput) || limitInput < 1 ? 25 : Math.min(limitInput, 100);

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const storeId = searchParams.get("store_id") || "all";
  const sortBy = searchParams.get("sort_by") || "created_at";
  const sortOrder = searchParams.get("sort_order") || "desc";

  const offset = (page - 1) * limit;

  try {
    const supabase = createAdminClient();
    const userStoreIds = await getAuthorizedStoreIds(auth.principal);

    if (userStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0 },
      });
    }

    let query = supabase
      .from("listings")
      .select("*, daraz_stores(store_name, store_code, region)", { count: "exact" });

    // 1. Store Filter & Multi-Store Security
    if (storeId !== "all") {
      if (!userStoreIds.includes(storeId)) {
        return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
      }
      query = query.eq("store_id", storeId);
    } else {
      query = query.in("store_id", userStoreIds);
    }

    // 2. Status Filter
    if (status === "out_of_stock") {
      query = query.eq("stock_quantity", 0);
    } else if (status === "low_stock") {
      query = query.gt("stock_quantity", 0).lte("stock_quantity", 10);
    } else if (status === "active") {
      query = query.gt("stock_quantity", 0);
    } else if (status === "inactive") {
      query = query.eq("is_synced", false);
    }

    // 3. Search Filter
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`title.ilike.${q},seller_sku.ilike.${q},daraz_item_id.ilike.${q}`);
    }

    // 4. Sorting & Pagination
    const validSortFields = ["created_at", "title", "price_cents", "stock_quantity"];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "created_at";

    query = query
      .order(safeSortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    const { data: listings, count, error } = await query;

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    // Query parent items count
    let parentItemsCountFromTable: number | null = null;
    try {
      let parentItemsQuery = supabase
        .from("daraz_products")
        .select("*", { count: "exact", head: true });

      if (storeId !== "all") {
        parentItemsQuery = parentItemsQuery.eq("store_id", storeId);
      } else {
        parentItemsQuery = parentItemsQuery.in("store_id", userStoreIds);
      }

      const { count: pCount } = await parentItemsQuery;
      parentItemsCountFromTable = pCount;
    } catch (e) {
      // Graceful fallback if table is missing
    }

    // Query distinct parent items from listings as fallback
    let distinctItemCount = 0;
    try {
      let distinctQuery = supabase
        .from("listings")
        .select("daraz_item_id");

      if (storeId !== "all") {
        distinctQuery = distinctQuery.eq("store_id", storeId);
      } else {
        distinctQuery = distinctQuery.in("store_id", userStoreIds);
      }

      const { data: distData } = await distinctQuery;
      distinctItemCount = new Set((distData || []).map((l: any) => l.daraz_item_id).filter(Boolean)).size;
    } catch (e) {}

    const totalItems = (typeof parentItemsCountFromTable === "number" && parentItemsCountFromTable > 0)
      ? parentItemsCountFromTable
      : (distinctItemCount > 0 ? distinctItemCount : (count || 0));

    return NextResponse.json({
      success: true,
      products: listings || [],
      metrics: {
        total_items: totalItems,
        total_skus: count || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/products Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch product catalog." },
      { status: 500 }
    );
  }
}
