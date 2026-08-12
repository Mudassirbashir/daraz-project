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
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from("listings")
      .select("*, daraz_stores(store_name, store_code, region)", { count: "exact" });

    // 1. Store Filter
    if (storeId !== "all") {
      query = query.eq("store_id", storeId);
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

    return NextResponse.json({
      success: true,
      products: listings || [],
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
