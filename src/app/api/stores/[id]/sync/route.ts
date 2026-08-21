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

    const supabase = createAdminClient();
    const { data: store, error } = await supabase
      .from("daraz_stores")
      .select("id, store_name, is_active, access_token, user_id")
      .eq("id", storeId)
      .maybeSingle();

    if (error || !store) {
      return NextResponse.json({ success: false, error: "Store not found." }, { status: 404 });
    }

    if (user && store.user_id && store.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Access denied to target store." }, { status: 403 });
    }

    if (!store.is_active || !store.access_token) {
      return NextResponse.json(
        { success: false, error: "Store is disconnected. Please connect the store before syncing." },
        { status: 400 }
      );
    }

    const syncResult = await executeDarazSync(storeId);

    return NextResponse.json({
      success: syncResult.success,
      result: syncResult,
    });
  } catch (err: any) {
    console.error(`[POST /api/stores/${storeId}/sync Exception]:`, err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to trigger store synchronization." },
      { status: 500 }
    );
  }
}
