import { NextRequest, NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId") || undefined;
  const result = await executeDarazSync(storeId, ["orders", "order_items"]);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    ordersSynced: result.ordersSynced,
    orderItemsSynced: result.orderItemsSynced || 0,
    durationMs: result.durationMs,
    errors: result.errors,
    timestamp: result.timestamp,
  });
}
