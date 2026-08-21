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
    const masterSkuId = requestUrl.searchParams.get("productId") || requestUrl.searchParams.get("masterSkuId");

    const supabase = createAdminClient();
    let query = supabase.from("inventory_ledger").select("*").order("created_at", { ascending: false }).limit(100);

    if (storeId && storeId !== "all") {
      query = query.eq("store_id", storeId);
    }

    if (masterSkuId) {
      query = query.eq("master_sku_id", masterSkuId);
    }

    const { data: ledger, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ledger: ledger || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to query inventory ledger." }, { status: 500 });
  }
}
