import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/security/encryption";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const opsUserCookie = req.cookies.get("daraz_ops_user")?.value;

    if (!user && !opsUserCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const customAppKey = String(body.app_key || "").trim();
    const customAppSecret = String(body.app_secret || "").trim();
    const storeUsername = String(body.store_username || body.store_label || "").trim();
    const reconnectStoreId = body.reconnect_store_id || body.store_id || null;

    const appKey = customAppKey || (process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = customAppSecret || (process.env.DARAZ_APP_SECRET || "").trim();

    if (!appKey || !appSecret) {
      return NextResponse.json(
        { success: false, error: "Daraz App Key and App Secret are required to initiate authorization." },
        { status: 400 }
      );
    }

    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");
    const redirectUri = `${baseUrl}/api/daraz/oauth/callback`;

    const supabase = createAdminClient();

    // 1. Save or update daraz_apps row
    const encryptedSecret = encryptSecret(appSecret);
    let darazAppId: string | null = null;

    try {
      const { data: existingApp } = await supabase
        .from("daraz_apps")
        .select("id")
        .eq("app_key", appKey)
        .maybeSingle();

      if (existingApp) {
        darazAppId = existingApp.id;
        await supabase
          .from("daraz_apps")
          .update({
            encrypted_app_secret: encryptedSecret,
            redirect_uri: redirectUri,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingApp.id);
      } else {
        const { data: newApp } = await supabase
          .from("daraz_apps")
          .insert({
            user_id: user?.id || null,
            app_key: appKey,
            encrypted_app_secret: encryptedSecret,
            redirect_uri: redirectUri,
            status: "active",
          })
          .select("id")
          .single();
        darazAppId = newApp?.id || null;
      }
    } catch (e: any) {
      console.warn("[OAuth Start] App record notice:", e.message);
    }

    // 2. Generate secure single-use OAuth state
    const randomHex = crypto.randomBytes(32).toString("hex");
    const csrfStateToken = reconnectStoreId ? `store_${reconnectStoreId}_${randomHex}` : randomHex;
    const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes TTL

    try {
      await supabase.from("daraz_oauth_states").insert({
        state: csrfStateToken,
        user_id: user?.id || null,
        daraz_app_id: darazAppId,
        store_username: storeUsername || null,
        reconnect_store_id: reconnectStoreId,
        expires_at: expiresAtIso,
      });
    } catch (e: any) {
      console.warn("[OAuth Start] State table insertion notice:", e.message);
    }

    // 3. Build official Daraz OAuth Authorization URL
    const authUrl = new URL("https://api.daraz.pk/oauth/authorize");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("force_auth", "true");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("client_id", appKey);
    authUrl.searchParams.append("state", csrfStateToken);

    const sessionPayload = {
      state: csrfStateToken,
      appKey,
      encryptedAppSecret: encryptedSecret,
      storeUsername: storeUsername || null,
      reconnectStoreId: reconnectStoreId || null,
      darazAppId,
      createdAt: Date.now(),
    };

    const response = NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      state: csrfStateToken,
      redirectUri,
    });

    // Set HttpOnly security cookies for fallback verification
    response.cookies.set("daraz_oauth_state", csrfStateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    response.cookies.set("daraz_onboarding_session", Buffer.from(JSON.stringify(sessionPayload)).toString("base64"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to start Daraz authorization." }, { status: 500 });
  }
}
