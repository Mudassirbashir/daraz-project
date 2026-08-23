import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  getAuthorizedStoreIds,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "orders:read" });
  if (!auth.ok) return auth.response;

  try {
    const requestUrl = new URL(req.url);
    const storeId = requestUrl.searchParams.get("storeId");
    const status = requestUrl.searchParams.get("status");
    const search = requestUrl.searchParams.get("search");
    const page = parseInt(requestUrl.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(requestUrl.searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    const authorizedStoreIds = await getAuthorizedStoreIds(auth.principal);
    if (authorizedStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
      });
    }

    if (storeId && storeId !== "all" && !authorizedStoreIds.includes(storeId)) {
      return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
    }

    const targetStoreIds = (storeId && storeId !== "all") ? [storeId] : authorizedStoreIds;

    const supabase = createAdminClient();
    let query = supabase
      .from("orders")
      .select("*, daraz_stores(id, store_name, store_code)", { count: "exact" })
      .in("store_id", targetStoreIds);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`daraz_order_id.ilike.%${search}%,customer_name.ilike.%${search}%,tracking_number.ilike.%${search}%`);
    }

    query = query.order("order_date", { ascending: false }).range(offset, offset + limit - 1);

    const { data: orders, count, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to query orders." }, { status: 500 });
  }
}
