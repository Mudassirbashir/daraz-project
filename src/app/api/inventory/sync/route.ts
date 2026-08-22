import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { pullStockForStore, pushStockToStore } from "@/lib/daraz/stock-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { store_id, action = "pull", updates } = body;

    const supabase = createAdminClient();

    // Query authorized active stores
    let storeQuery = supabase.from("daraz_stores").select("id").eq("is_active", true);
    if (user?.id) {
      storeQuery = storeQuery.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data: userStores } = await storeQuery;
    const userStoreIds = (userStores || []).map((s) => s.id);

    if (userStoreIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No active connected stores found." },
        { status: 400 }
      );
    }

    let targetStoreIds = userStoreIds;
    if (store_id && store_id !== "all") {
      if (!userStoreIds.includes(store_id)) {
        return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
      }
      targetStoreIds = [store_id];
    }

    if (action === "push") {
      if (!store_id || store_id === "all") {
        return NextResponse.json({ success: false, error: "Push action requires a specific store_id." }, { status: 400 });
      }
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ success: false, error: "Push action requires an array of updates." }, { status: 400 });
      }

      const pushRes = await pushStockToStore(store_id, updates);
      return NextResponse.json({
        success: pushRes.success,
        message: pushRes.success
          ? `Successfully pushed ${pushRes.pushedCount} stock/price update(s) to Daraz.`
          : `Failed to push stock: ${pushRes.errors.join("; ")}`,
        result: pushRes,
      });
    }

    // Pull stock for target stores concurrently
    const pullPromises = targetStoreIds.map((sId) => pullStockForStore(sId));
    const pullResults = await Promise.all(pullPromises);

    const totalSkusUpdated = pullResults.reduce((sum, r) => sum + r.skusUpdated, 0);
    const allErrors = pullResults.flatMap((r) => r.errors);

    return NextResponse.json({
      success: allErrors.length === 0,
      message: `Stock pull completed across ${pullResults.length} store(s). Updated ${totalSkusUpdated} SKU stock level(s).`,
      storesSynced: pullResults.length,
      skusUpdated: totalSkusUpdated,
      details: pullResults,
      errors: allErrors,
    });
  } catch (err: any) {
    console.error("[POST /api/inventory/sync Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to synchronize stock." },
      { status: 500 }
    );
  }
}
