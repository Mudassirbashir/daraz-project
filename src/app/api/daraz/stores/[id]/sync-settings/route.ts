import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStoreSyncSettings, updateStoreSyncSettings } from "@/lib/daraz/sync-settings-service";

export const dynamic = "force-dynamic";

export async function GET(
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

    const settings = await getStoreSyncSettings(storeId);
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch store sync settings." },
      { status: 500 }
    );
  }
}

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
    const settings = await updateStoreSyncSettings(storeId, body);

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update store sync settings." },
      { status: 500 }
    );
  }
}
