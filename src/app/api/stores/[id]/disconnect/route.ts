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
    let user: any = null;
    try {
      const serverSupabase = createClient();
      const { data } = await serverSupabase.auth.getUser();
      user = data?.user || null;
    } catch (authErr) {
      console.warn("[Disconnect API Auth Check Warning]:", authErr);
    }

    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access. Please log in to manage stores." }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch target store
    const { data: store, error: fetchErr } = await supabase
      .from("daraz_stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();

    if (fetchErr || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    // Security check: verify store ownership if user_id is set
    if (user && store.user_id && store.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied to disconnect this store." }, { status: 403 });
    }

    // Idempotency check: if store is already disconnected, return clean success
    if (!store.is_active && !store.access_token) {
      return NextResponse.json({
        success: true,
        alreadyDisconnected: true,
        message: `Store '${store.store_name}' is already disconnected.`,
      });
    }

    // Execute Store Disconnect and Clean Up Store Data in Supabase
    try { await supabase.from("listings").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("orders").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_products").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_product_skus").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("inventory").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("sync_runs").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_api_logs").delete().eq("store_id", storeId); } catch (_) {}

    const disconnectData: Record<string, any> = {
      is_active: false,
      sync_status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      seller_id: null,
      slot_number: null,
      last_synced_at: null,
      updated_at: new Date().toISOString(),
    };

    let updateErr: any = null;
    const { error } = await supabase
      .from("daraz_stores")
      .update(disconnectData)
      .eq("id", storeId);

    if (error && error.message?.includes("slot_number")) {
      const { slot_number, ...fallbackDisconnectData } = disconnectData;
      const { error: fallbackErr } = await supabase
        .from("daraz_stores")
        .update(fallbackDisconnectData)
        .eq("id", storeId);
      updateErr = fallbackErr;
    } else {
      updateErr = error;
    }

    if (updateErr) {
      throw new Error(`Database error while disconnecting store: ${updateErr.message}`);
    }

    // Insert audit log
    try {
      await supabase.from("audit_logs").insert({
        user_id: user?.id || null,
        actor_name: user?.email || "System",
        entity_type: "daraz_store",
        entity_id: storeId,
        action: "disconnect_store",
        changes: {
          store_name: store.store_name,
          store_code: store.store_code,
          disconnected_at: new Date().toISOString(),
          purged_data: true,
        },
        source: "stores_ui",
      });
    } catch (auditErr) {
      // Ignore audit failure
    }

    return NextResponse.json({
      success: true,
      message: `Store '${store.store_name}' and all associated products, items, and orders have been cleaned up from Supabase.`,
    });
  } catch (err: any) {
    console.error("[POST /api/stores/[id]/disconnect Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to disconnect store." },
      { status: 500 }
    );
  }
}
