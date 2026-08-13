import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Query failed items from sync_retry_queue
    const { data: retryErrors, error: retryErr } = await supabase
      .from("sync_retry_queue")
      .select("*, daraz_stores(id, store_name, store_code)")
      .order("created_at", { ascending: false })
      .limit(50);

    // Query failed items from daraz_api_logs
    const { data: apiLogs, error: logsErr } = await supabase
      .from("daraz_api_logs")
      .select("*, daraz_stores(id, store_name, store_code)")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: true,
      retryErrors: retryErrors || [],
      apiLogs: apiLogs || [],
    });
  } catch (err: any) {
    console.error("[GET /api/admin/errors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch error diagnostics." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { errorId, action } = body as { errorId?: string; action?: "retry_sync" | "retry_item" | "clear_resolved" };

    const supabase = createAdminClient();

    if (action === "retry_sync") {
      // Execute safe Daraz sync engine
      const syncResult = await executeDarazSync();
      return NextResponse.json({
        success: syncResult.success,
        message: syncResult.success
          ? "✓ Synchronization completed successfully."
          : `Sync completed with notice: ${syncResult.errors.join("; ")}`,
        syncResult,
      });
    }

    if (errorId && action === "retry_item") {
      // Fetch error item
      const { data: errRecord } = await supabase
        .from("sync_retry_queue")
        .select("*")
        .eq("id", errorId)
        .single();

      if (errRecord) {
        const nextAttempt = (errRecord.attempt_count || 1) + 1;
        const timestamp = new Date().toISOString();

        // Update retry attempt count
        await supabase
          .from("sync_retry_queue")
          .update({
            attempt_count: nextAttempt,
            last_attempt_at: timestamp,
            status: "retrying",
          })
          .eq("id", errorId);

        // Attempt fresh sync execution
        const syncResult = await executeDarazSync();

        if (syncResult.success) {
          await supabase
            .from("sync_retry_queue")
            .update({ status: "resolved" })
            .eq("id", errorId);
        }

        return NextResponse.json({
          success: syncResult.success,
          message: syncResult.success ? "✓ Error item resolved via retry." : "Retry attempted. Failure logged.",
          attemptCount: nextAttempt,
        });
      }
    }

    if (action === "clear_resolved") {
      await supabase
        .from("sync_retry_queue")
        .delete()
        .eq("status", "resolved");

      return NextResponse.json({ success: true, message: "✓ Cleared resolved error logs." });
    }

    return NextResponse.json({ success: false, error: "Invalid action parameters." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/admin/errors Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute error retry." },
      { status: 500 }
    );
  }
}
