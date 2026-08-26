import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/encryption";

/**
 * Store tokens obtained from client-side Daraz token exchange
 * POST /api/daraz/asaan-retail/store-tokens
 * Body: {
 *   state: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresIn: number, // seconds until expiration
 *   storeId?: string,
 *   storeName?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const requestUrl = new URL(req.url);
    const state = requestUrl.searchParams.get("state");

    // Validate state parameter
    if (!state) {
      return NextResponse.json(
        { success: false, error: "Missing state parameter" },
        { status: 400 }
      );
    }

    // Verify state matches cookie (security check)
    const stateCookie = req.cookies.get("daraz_asaan_oauth_state")?.value;
    if (stateCookie !== state) {
      return NextResponse.json(
        { success: false, error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Get session payload from cookie
    const sessionCookie = req.cookies.get("daraz_asaan_onboarding_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "Session expired. Please restart the authentication process." },
        { status: 400 }
      );
    }

    let sessionPayload;
    try {
      sessionPayload = JSON.parse(
        Buffer.from(sessionCookie, "base64").toString("utf-8")
      );
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: "Invalid session data" },
        { status: 400 }
      );
    }

    // Check session age
    const sessionAge = Date.now() - sessionPayload.createdAt;
    if (sessionAge > 10 * 60 * 1000) { // 10 minutes
      return NextResponse.json(
        { success: false, error: "Session expired. Please restart the authentication process." },
        { status: 400 }
      );
    }

    // Get token data from request body
    const { accessToken, refreshToken, expiresIn, storeId: providedStoreId, storeName } = await req.json();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Access token is required" },
        { status: 400 }
      );
    }

    // Determine store ID
    const storeId = providedStoreId || sessionPayload.reconnectStoreId ||
                   `asaan_retail_${Date.now()}`;

    const supabase = createAdminClient();

    // Get or create app credentials
    let appKey = sessionPayload.appKey;
    let appSecret = sessionPayload.appSecret; // This is encrypted

    let darazAppId: string | null = null;

    // Check if we already have an app record
    const { data: existingApp } = await supabase
      .from("daraz_apps")
      .select("id")
      .eq("app_key", appKey)
      .maybeSingle();

    if (existingApp) {
      darazAppId = existingApp.id;
      // Update app secret if needed (should be same)
      await supabase
        .from("daraz_apps")
        .update({
          encrypted_app_secret: appSecret,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/daraz/asaan-retail/callback`,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id);
    } else {
      // Create new app record
      const { data: newApp } = await supabase
        .from("daraz_apps")
        .insert({
          user_id: null, // Will be set when user connects a store
          app_key: appKey,
          encrypted_app_secret: appSecret,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/daraz/asaan-retail/callback`,
          status: "active",
        })
        .select("id")
        .single();
      darazAppId = newApp?.id || null;
    }

    // Calculate expiration time
    const tokenExpiresAt = new Date(Date.now() + (expiresIn || 2592000) * 1000).toISOString(); // Default 30 days

    // Create or update store connection
    await supabase
      .from("daraz_stores")
      .upsert({
        id: storeId,
        store_name: storeName || sessionPayload.storeUsername || "Asaan Retail Connected Store",
        store_code: `ASAAN-${Date.now().toString().slice(-6)}`,
        seller_id: null, // Will be fetched after first API call
        daraz_app_id: darazAppId,
        authorization_status: "authorized",
        sync_status: "connected",
        is_active: true,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    // Create or update store credentials with tokens
    await supabase
      .from("daraz_store_credentials")
      .upsert({
        store_id: storeId,
        api_app_key: sessionPayload.appKey,
        api_app_secret: sessionPayload.appSecret, // Already encrypted
        access_token: accessToken,
        refresh_token: refreshToken || "", // May be empty if not rotated
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });

    // Clear cookies
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/stores?connected=${storeId}`
    );

    response.cookies.delete("daraz_asaan_onboarding_session");
    response.cookies.delete("daraz_asaan_oauth_state");

    return response;

  } catch (err: any) {
    console.error("[Asaan Retail Store Tokens] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to store tokens" },
      { status: 500 }
    );
  }
}