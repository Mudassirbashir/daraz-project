import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, maskSecret } from "@/lib/security/encryption";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;
    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const supabase = createAdminClient();
    let query = supabase.from("daraz_apps").select("id, app_key, encrypted_app_secret, redirect_uri, status, created_at, updated_at");

    if (user?.id) {
      query = query.or(`user_id.eq.${user.id},user_id.is.null`);
    }

    const { data: apps, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const sanitizedApps = (apps || []).map((app) => ({
      id: app.id,
      app_key: app.app_key,
      masked_app_secret: maskSecret(app.encrypted_app_secret),
      redirect_uri: app.redirect_uri,
      status: app.status,
      created_at: app.created_at,
    }));

    return NextResponse.json({ success: true, apps: sanitizedApps });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch Daraz apps." }, { status: 500 });
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
    const appKey = String(body.app_key || "").trim();
    const appSecret = String(body.app_secret || "").trim();

    if (!appKey || !appSecret) {
      return NextResponse.json({ success: false, error: "App Key and App Secret are required." }, { status: 400 });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/daraz/oauth/callback`;

    const encryptedAppSecret = encryptSecret(appSecret);
    const supabase = createAdminClient();

    // Check existing app by app_key
    const { data: existingApp } = await supabase
      .from("daraz_apps")
      .select("id")
      .eq("app_key", appKey)
      .maybeSingle();

    let appData: any;
    if (existingApp) {
      const { data, error } = await supabase
        .from("daraz_apps")
        .update({
          encrypted_app_secret: encryptedAppSecret,
          redirect_uri: redirectUri,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id)
        .select()
        .single();

      if (error) throw error;
      appData = data;
    } else {
      const { data, error } = await supabase
        .from("daraz_apps")
        .insert({
          user_id: user?.id || null,
          app_key: appKey,
          encrypted_app_secret: encryptedAppSecret,
          redirect_uri: redirectUri,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;
      appData = data;
    }

    return NextResponse.json({
      success: true,
      app: {
        id: appData.id,
        app_key: appData.app_key,
        masked_app_secret: maskSecret(appSecret),
        redirect_uri: appData.redirect_uri,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to save Daraz app configuration." }, { status: 500 });
  }
}
