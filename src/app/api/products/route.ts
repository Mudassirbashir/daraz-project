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

    // Query authorized active stores
    let storeQuery = supabase.from("daraz_stores").select("id").eq("is_active", true);
    if (user?.id) {
      storeQuery = storeQuery.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data: userStores } = await storeQuery;
    const userStoreIds = (userStores || []).map((s) => s.id);

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
    let parentItemsQuery = supabase
      .from("daraz_products")
      .select("*", { count: "exact", head: true });

    if (storeId !== "all") {
      parentItemsQuery = parentItemsQuery.eq("store_id", storeId);
    } else {
      parentItemsQuery = parentItemsQuery.in("store_id", userStoreIds);
    }

    const { count: parentItemsCount } = await parentItemsQuery;
    const totalItems = (typeof parentItemsCount === "number" && parentItemsCount > 0) ? parentItemsCount : (count || 0);

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
