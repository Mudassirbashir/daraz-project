import { NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export async function POST() {
  try {
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

export async function GET() {
  // Allow GET requests for convenience testing / manual triggers
  return POST();
}
