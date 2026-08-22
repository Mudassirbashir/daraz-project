import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeId = body.store_id || body.id;

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "Missing required 'store_id' parameter in request body." },
        { status: 400 }
      );
    }

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

    const { data: store, error: fetchErr } = await supabase
      .from("daraz_stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();

    if (fetchErr || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    if (user && store.user_id && store.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied to disconnect this store." }, { status: 403 });
    }

    const { data: creds } = await supabase
      .from("daraz_store_credentials")
      .select("access_token")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!store.is_active && (!creds || !creds.access_token) && store.authorization_status === "disconnected") {
      return NextResponse.json({
        success: true,
        alreadyDisconnected: true,
        message: `Store '${store.store_name}' is already disconnected.`,
      });
    }

    // Clean up store credentials & listings & related data
    try { await supabase.from("daraz_store_credentials").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("listings").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("orders").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_products").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_product_skus").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("inventory").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("sync_runs").delete().eq("store_id", storeId); } catch (_) {}
    try { await supabase.from("daraz_api_logs").delete().eq("store_id", storeId); } catch (_) {}

    const { error: deleteStoreErr } = await supabase
      .from("daraz_stores")
      .delete()
      .eq("id", storeId);

    if (deleteStoreErr) {
      const fallbackDisconnectData: Record<string, any> = {
        is_active: false,
        sync_status: "disconnected",
        authorization_status: "disconnected",
        last_synced_at: null,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("daraz_stores")
        .update(fallbackDisconnectData)
        .eq("id", storeId);
    }

    return NextResponse.json({
      success: true,
      message: `Store '${store.store_name}' and all associated products, items, and orders have been cleaned up.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to disconnect store." },
      { status: 500 }
    );
  }
}
