import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  getAuthorizedStoreIds,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "inventory:read" });
  if (!auth.ok) return auth.response;

  try {
    const requestUrl = new URL(req.url);
    const storeId = requestUrl.searchParams.get("storeId");
    const search = requestUrl.searchParams.get("search");

    const authorizedStoreIds = await getAuthorizedStoreIds(auth.principal);
    if (authorizedStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        inventory: [],
      });
    }

    if (storeId && storeId !== "all" && !authorizedStoreIds.includes(storeId)) {
      return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
    }

    const targetStoreIds = (storeId && storeId !== "all") ? [storeId] : authorizedStoreIds;

    const supabase = createAdminClient();
    let query = supabase
      .from("inventory")
      .select("*, daraz_stores(id, store_name, store_code)")
      .in("store_id", targetStoreIds);

    if (search) {
      query = query.or(`sku.ilike.%${search}%,title.ilike.%${search}%`);
    }

    const { data: inventory, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inventory: inventory || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to query inventory." }, { status: 500 });
  }
}
