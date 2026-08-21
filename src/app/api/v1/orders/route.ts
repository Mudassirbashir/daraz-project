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

    const requestUrl = new URL(req.url);
    const storeId = requestUrl.searchParams.get("storeId");
    const status = requestUrl.searchParams.get("status");
    const search = requestUrl.searchParams.get("search");
    const page = parseInt(requestUrl.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(requestUrl.searchParams.get("limit") || "50", 10), 100);
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();
    let query = supabase.from("orders").select("*, daraz_stores(id, store_name, store_code)", { count: "exact" });

    if (storeId && storeId !== "all") {
      query = query.eq("store_id", storeId);
    }

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
