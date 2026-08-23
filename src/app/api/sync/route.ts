import { NextRequest, NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";
import { pullStockForStore } from "@/lib/daraz/stock-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuthenticatedUser,
  requireAuthorizedStore,
  safeErrorResponse,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(req: NextRequest): boolean {
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  return Boolean(
    isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`)
  );
}

export async function POST(req: NextRequest) {
  // Cron jobs use Bearer secret. All other callers must have a verified session.
  const isCron = isAuthorizedCronRequest(req);

  let principal: { userId: string; email: string | null; role: any } | null = null;
  if (!isCron) {
    const auth = await requireAuthenticatedUser(req, { permission: "sync:execute" });
    if (!auth.ok) return auth.response;
    principal = auth.principal;
  }

  let targetStoreId: string | undefined;
  let targetModule: string | undefined;
  try {
    const url = new URL(req.url);
    targetStoreId = url.searchParams.get("store_id") || undefined;
    targetModule = url.searchParams.get("module") || undefined;

    if (req.method === "POST") {
      try {
        const body = await req.clone().json();
        if (!targetStoreId && body?.store_id) targetStoreId = body.store_id;
        if (!targetModule && body?.module) targetModule = body.module;
      } catch {
        /* empty body is fine */
      }
    }
  } catch {
    /* ignore url errors */
  }

  // Non-cron requests must own the target store.
  if (principal && targetStoreId && !isCron) {
    const storeAuth = await requireAuthorizedStore(principal, targetStoreId);
    if (!storeAuth.ok) return storeAuth.response;
  }

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

  const result = await executeDarazSync(targetStoreId);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    message: result.success
      ? `Successfully synced ${result.productsSynced} products and ${result.ordersSynced} orders across ${result.storesSynced} store(s).`
      : result.errorMessage || "Sync completed with warnings or errors.",
    failedModule: result.failedModule || null,
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
    storesSynced: result.storesSynced,
    productsSynced: result.productsSynced,
    skusSynced: result.skusSynced,
    itemsSynced: result.itemsSynced,
    ordersSynced: result.ordersSynced,
    orderItemsSynced: result.orderItemsSynced || 0,
    durationMs: result.durationMs,
    durationFormatted: `${(result.durationMs / 1000).toFixed(2)}s`,
    moduleResults: result.moduleResults || {},
    modules: result.moduleResults || {},
    errors: result.errors,
    timestamp: result.timestamp,
    result,
  });
}

/**
 * GET /api/sync — read-only sync status.
 * Deliberately does NOT trigger a sync; POST does.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "sync:read" });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("sync_runs")
    .select("id, store_id, status, started_at, completed_at, trigger_type")
    .order("started_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    success: true,
    recentRuns: runs || [],
    timestamp: new Date().toISOString(),
  });
}
