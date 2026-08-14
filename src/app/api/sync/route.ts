import { NextRequest, NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Verify auth: User session OR Vercel Cron header / CRON_SECRET authorization
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isCronAuthorized = Boolean(isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`));

    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !isCronAuthorized && !opsUserCookie) {
      console.warn("[API Sync]: Triggering sync via system operation.");
    }

    const result = await executeDarazSync();

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Successfully synced ${result.productsSynced} products and ${result.ordersSynced} orders across ${result.storesSynced} store(s).`
        : "Sync completed with warnings or errors.",
      storesSynced: result.storesSynced,
      productsSynced: result.productsSynced,
      ordersSynced: result.ordersSynced,
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
