import { NextRequest, NextResponse } from "next/server";
import { executeDarazSync } from "@/lib/daraz/sync-service";
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
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const moduleName = String(body.module || body.module_name || "").trim().toLowerCase();

    if (!moduleName) {
      return NextResponse.json(
        { success: false, error: "Target module name is required (e.g. 'orders', 'products', 'inventory', 'product_images', 'shipping_labels')." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: store, error } = await supabase
      .from("daraz_stores")
      .select("id, store_name, is_active, authorization_status, user_id")
      .eq("id", storeId)
      .maybeSingle();

    if (error || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    if (user && store.user_id && store.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
    }

    const { data: creds } = await supabase
      .from("daraz_store_credentials")
      .select("access_token")
      .eq("store_id", storeId)
      .maybeSingle();

    const hasToken = Boolean(creds?.access_token || store.authorization_status === "authorized");

    if (!store.is_active || !hasToken) {
      return NextResponse.json(
        { success: false, error: "Store is disconnected. Please connect the store before syncing modules." },
        { status: 400 }
      );
    }

    // Execute single module sync
    const syncResult = await executeDarazSync(storeId, [moduleName]);

    return NextResponse.json({
      success: syncResult.success,
      module: moduleName,
      result: syncResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute module sync." },
      { status: 500 }
    );
  }
}
