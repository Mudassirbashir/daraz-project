import { NextRequest, NextResponse } from "next/server";
import { getGlobalSyncSettings, updateGlobalSyncSettings } from "@/lib/daraz/sync-settings-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const settings = await getGlobalSyncSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load global sync settings." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const settings = await updateGlobalSyncSettings(body);

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update global sync settings." },
      { status: 500 }
    );
  }
}
