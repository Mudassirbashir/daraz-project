import { NextRequest, NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";
import { pullStockForStore } from "@/lib/daraz/stock-sync";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCronAuthorized = Boolean(isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`));
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie && !isCronAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const requestUrl = new URL(req.url);
    let targetStoreId = requestUrl.searchParams.get("store_id") || undefined;
    let targetModule = requestUrl.searchParams.get("module") || undefined;

    if (req.method === "POST") {
      try {
        const body = await req.clone().json();
        if (!targetStoreId && body?.store_id) targetStoreId = body.store_id;
        if (!targetModule && body?.module) targetModule = body.module;
      } catch (e) {
        // ignore JSON parse error
      }
    }

    // Require authorization for target store if specified
    if (user?.id && targetStoreId && !isCronAuthorized) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      const { data: storeCheck } = await adminSupabase
        .from("daraz_stores")
        .select("id")
        .eq("id", targetStoreId)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .maybeSingle();

      if (!storeCheck) {
        return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
      }
    }

    // Modular Stock-Only Sync requested
    if (targetModule === "stock" && targetStoreId) {
      const stockRes = await pullStockForStore(targetStoreId);
      return NextResponse.json({
        success: stockRes.success,
        message: stockRes.success
          ? `Successfully synced ${stockRes.skusUpdated} stock SKU(s).`
          : `Stock sync failed: ${stockRes.errors.join("; ")}`,
        skusSynced: stockRes.skusUpdated,
        errors: stockRes.errors,
        timestamp: stockRes.timestamp,
      });
    }

    // Default Full Catalog + Orders Sync
    const result = await executeDarazSync(targetStoreId);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Successfully synced ${result.productsSynced} products and ${result.ordersSynced} orders across ${result.storesSynced} store(s).`
        : "Sync completed with warnings or errors.",
      storesSynced: result.storesSynced,
      productsSynced: result.productsSynced,
      skusSynced: result.skusSynced,
      itemsSynced: result.itemsSynced,
      ordersSynced: result.ordersSynced,
      orderItemsSynced: result.orderItemsSynced || 0,
      durationMs: result.durationMs,
      durationFormatted: `${(result.durationMs / 1000).toFixed(2)}s`,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected error occurred during Daraz sync.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
