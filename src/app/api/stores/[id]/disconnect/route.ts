import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const storeId = params.id;

  if (!storeId) {
    return NextResponse.json({ success: false, error: "Store ID is required." }, { status: 400 });
  }

  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch target store to verify ownership
    const { data: store, error: fetchErr } = await supabase
      .from("daraz_stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();

    if (fetchErr || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    // Security check: user must own store or store must be unassigned
    if (store.user_id && store.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied to disconnect this store." }, { status: 403 });
    }

    // Execute Store Disconnect (removes API tokens, sets inactive, preserves historical data)
    const { error: updateErr } = await supabase
      .from("daraz_stores")
      .update({
        is_active: false,
        sync_status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        last_sync_error: "Store disconnected by user.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);

    if (updateErr) {
      throw new Error(`Database error while disconnecting store: ${updateErr.message}`);
    }

    // Insert audit log
    try {
      await supabase.from("audit_logs").insert({
        store_id: storeId,
        user_id: user.id,
        action: "disconnect_store",
        entity_type: "daraz_store",
        entity_id: storeId,
        details: {
          store_name: store.store_name,
          store_code: store.store_code,
          disconnected_at: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      // Ignore if audit log fails
    }

    return NextResponse.json({
      success: true,
      message: `Store '${store.store_name}' has been securely disconnected from Daraz Hub. Historical records are preserved.`,
    });
  } catch (err: any) {
    console.error("[POST /api/stores/[id]/disconnect Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to disconnect store." },
      { status: 500 }
    );
  }
}
