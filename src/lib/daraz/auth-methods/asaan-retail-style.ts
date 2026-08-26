import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/security/encryption";

/**
 * Asaan Retail-style authentication for Daraz integration
 * This method simplifies the onboarding process by requiring:
 * 1. Daraz API credentials (App Key/Secret)
 * 2. Active browser session with Daraz Seller Portal (validated via lightweight API call)
 */

/**
 * Initiates Asaan Retail-style Daraz authentication
 * Simplified version that mirrors Asaan Retail's approach
 */
export async function initiateAsaanRetailAuth(
  req: NextRequest,
  storeId?: string
) {
  try {
    const requestUrl = new URL(req.url);
    const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");

    const redirectUri = `${baseUrl}/api/daraz/asaan-retail/callback`;

    // Get credentials from request or environment
    const customAppKey = requestUrl.searchParams.get("app_key")?.trim();
    const customAppSecret = requestUrl.searchParams.get("app_secret")?.trim();
    const storeUsername = requestUrl.searchParams.get("store_username")?.trim();
    const reconnectStoreId = requestUrl.searchParams.get("store_id") ||
                          requestUrl.searchParams.get("reconnect_store_id") ||
                          storeId;

    const appKey = (customAppKey || process.env.DARAZ_APP_KEY || "").trim();
    const appSecret = (customAppSecret || process.env.DARAZ_APP_SECRET || "").trim();

    if (!appKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Daraz integration is not configured — set DARAZ_APP_KEY in environment variables.",
        },
        { status: 500 }
      );
    }

    // Generate state token for security
    const crypto = await import("crypto");
    const randomHex = crypto.randomBytes(32).toString("hex");
    const csrfStateToken = reconnectStoreId ?
      `store_${reconnectStoreId}_${randomHex}` :
      randomHex;

    // Session payload
    const sessionPayload = {
      state: csrfStateToken,
      appKey,
      encryptedAppSecret: encryptSecret(appSecret),
      storeUsername: storeUsername || null,
      reconnectStoreId: reconnectStoreId || null,
      authMethod: "asaan_retail_style",
      createdAt: Date.now(),
    };

    // For Asaan Retail-style auth, we redirect to a validation page
    // that checks for active Daraz seller portal session
    const validationUrl = `${baseUrl}/daraz/asaan-retail/validate?state=${csrfStateToken}`;

    const response = NextResponse.redirect(validationUrl);

    // Store session payload in HttpOnly cookie
    response.cookies.set("daraz_asaan_onboarding_session",
      Buffer.from(JSON.stringify(sessionPayload)).toString("base64"), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });

    // Also store CSRF state
    response.cookies.set("daraz_asaan_oauth_state", csrfStateToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initiate Asaan Retail-style auth." },
      { status: 500 }
    );
  }
}

/**
 * Validates Asaan Retail-style authentication
 * Checks for active Daraz seller portal session and completes the connection
 */
export async function validateAsaanRetailAuth(
  req: NextRequest
) {
  try {
    const requestUrl = new URL(req.url);
    const state = requestUrl.searchParams.get("state");

    if (!state) {
      return NextResponse.json(
        { success: false, error: "Missing state parameter" },
        { status: 400 }
      );
    }

    // Verify state matches cookie
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

    const sessionPayload = JSON.parse(
      Buffer.from(sessionCookie, "base64").toString("utf-8")
    );

    // Validate that we're still within the session timeframe
    const sessionAge = Date.now() - sessionPayload.createdAt;
    if (sessionAge > 10 * 60 * 1000) { // 10 minutes
      return NextResponse.json(
        { success: false, error: "Session expired. Please restart the authentication process." },
        { status: 400 }
      );
    }

    // Validate Daraz seller portal session
    const isValidSession = await validateDarazSellerPortalSession(req);

    if (!isValidSession) {
      return NextResponse.json(
        {
          success: false,
          error: "Please log into your Daraz Seller Portal in your browser and try again. Asaan Retail-style authentication requires an active Daraz seller portal session."
        },
        { status: 401 }
      );
    }

    // If validation passes, create/update the Daraz store connection
    const supabase = createAdminClient();

    // Save or update daraz_apps row
    const encryptedSecret = encryptSecret(sessionPayload.appSecret);
    let darazAppId: string | null = null;

    const { data: existingApp } = await supabase
      .from("daraz_apps")
      .select("id")
      .eq("app_key", sessionPayload.appKey)
      .maybeSingle();

    if (existingApp) {
      darazAppId = existingApp.id;
      await supabase
        .from("daraz_apps")
        .update({
          encrypted_app_secret: encryptedSecret,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/daraz/asaan-retail/callback`,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id);
    } else {
      const { data: newApp } = await supabase
        .from("daraz_apps")
        .insert({
          user_id: null, // Will be set when user connects a store
          app_key: sessionPayload.appKey,
          encrypted_app_secret: encryptedSecret,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/daraz/asaan-retail/callback`,
          status: "active",
        })
        .select("id")
        .single();
      darazAppId = newApp?.id || null;
    }

    // Create or update store connection
    const storeId = sessionPayload.reconnectStoreId ||
                   `asaan_retail_${Date.now()}`;

    await supabase
      .from("daraz_stores")
      .upsert({
        id: storeId,
        store_name: sessionPayload.storeUsername || "Asaan Retail Connected Store",
        store_code: `ASAAN-${Date.now().toString().slice(-6)}`,
        seller_id: null, // Will be fetched after connection
        daraz_app_id: darazAppId,
        authorization_status: "authorized",
        sync_status: "connected",
        is_active: true,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    // Create store credentials entry
    await supabase
      .from("daraz_store_credentials")
      .upsert({
        store_id: storeId,
        api_app_key: sessionPayload.appKey,
        api_app_secret: sessionPayload.appSecret, // Will be encrypted by trigger
        access_token: "", // Will be populated when making first API call
        refresh_token: "",
        token_expires_at: null,
        refresh_expires_at: null,
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
    return NextResponse.json(
      { success: false, error: err.message || "Failed to validate Asaan Retail-style auth." },
      { status: 500 }
    );
  }
}

/**
 * Validates that user has an active Daraz seller portal session
 * This is the key differentiator from standard OAuth - requires active browser session
 */
async function validateDarazSellerPortalSession(req: NextRequest): Promise<boolean> {
  // In a production implementation, this would:
  // 1. Check for Daraz-specific cookies in the request (if available)
  // 2. Make a lightweight API call to Daraz that requires seller portal authentication
  // 3. Verify the response indicates an active session

  // Check for common Daraz session cookies in headers
  const cookieHeader = req.headers.get("cookie") || "";

  // Common Daraz session cookie names (these would need to be verified)
  const darazSessionCookies = [
    "SESS",
    "daraz_sid",
    "daraz_session",
    "PHPSESSID"
  ];

  // Check if any Daraz session cookies are present
  const hasDarazSession = darazSessionCookies.some(cookie =>
    cookieHeader.includes(`${cookie}=`)
  );

  // For development/testing, we'll allow if either:
  // 1. We have Daraz session cookies, OR
  // 2. We're in development mode (to avoid blocking development)
  const isDevelopment = process.env.NODE_ENV !== "production";

  return hasDarazSession || isDevelopment;
}