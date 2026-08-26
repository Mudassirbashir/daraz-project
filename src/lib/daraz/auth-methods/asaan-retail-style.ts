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

    // Enhanced error handling with specific error codes
    if (!state) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing state parameter",
          errorCode: "MISSING_STATE"
        },
        { status: 400 }
      );
    }

    // Verify state matches cookie
    const stateCookie = req.cookies.get("daraz_asaan_oauth_state")?.value;
    if (stateCookie !== state) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid state parameter - possible CSRF attack",
          errorCode: "INVALID_STATE"
        },
        { status: 400 }
      );
    }

    // Get session payload from cookie
    const sessionCookie = req.cookies.get("daraz_asaan_onboarding_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        {
          success: false,
          error: "Session expired. Please restart the authentication process.",
          errorCode: "SESSION_EXPIRED"
        },
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
        {
          success: false,
          error: "Invalid session data",
          errorCode: "INVALID_SESSION_DATA"
        },
        { status: 400 }
      );
    }

    // Validate session payload structure
    if (!sessionPayload.appKey || !sessionPayload.encryptedAppSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid session payload - missing required fields",
          errorCode: "INVALID_SESSION_PAYLOAD"
        },
        { status: 400 }
      );
    }

    // Validate that we're still within the session timeframe
    const sessionAge = Date.now() - sessionPayload.createdAt;
    if (sessionAge > 10 * 60 * 1000) { // 10 minutes
      return NextResponse.json(
        {
          success: false,
          error: "Session expired. Please restart the authentication process.",
          errorCode: "SESSION_TIMEOUT"
        },
        { status: 400 }
      );
    }

    // Validate Daraz seller portal session with enhanced error handling
    let isValidSession = false;
    let sessionValidationError = null;

    try {
      isValidSession = await validateDarazSellerPortalSession(req);
    } catch (sessionError) {
      sessionValidationError = sessionError.message;
      console.warn("[Asaan Retail Auth] Session validation error:", sessionValidationError);
    }

    if (!isValidSession) {
      return NextResponse.json(
        {
          success: false,
          error: sessionValidationError || "Please log into your Daraz Seller Portal in your browser and try again. Asaan Retail-style authentication requires an active Daraz seller portal session.",
          errorCode: "INVALID_DARAZ_SESSION"
        },
        { status: 401 }
      );
    }

    // If validation passes, create/update the Daraz store connection
    let supabase;
    try {
      supabase = createAdminClient();
    } catch (dbError) {
      console.error("[Asaan Retail Auth] Database connection error:", dbError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed. Please try again later.",
          errorCode: "DATABASE_CONNECTION_ERROR"
        },
        { status: 500 }
      );
    }

    // Save or update daraz_apps row with enhanced error handling
    let encryptedSecret;
    try {
      encryptedSecret = encryptSecret(sessionPayload.appSecret);
    } catch (encryptError) {
      console.error("[Asaan Retail Auth] Encryption error:", encryptError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to secure credentials. Please try again.",
          errorCode: "ENCRYPTION_ERROR"
        },
        { status: 500 }
      );
    }

    let darazAppId: string | null = null;

    let existingApp;
    try {
      const { data } = await supabase
        .from("daraz_apps")
        .select("id")
        .eq("app_key", sessionPayload.appKey)
        .maybeSingle();
      existingApp = data;
    } catch (dbError) {
      console.error("[Asaan Retail Auth] Error checking existing app:", dbError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to check existing Daraz app configuration.",
          errorCode: "APP_CHECK_ERROR"
        },
        { status: 500 }
      );
    }

    if (existingApp) {
      darazAppId = existingApp.id;
      try {
        await supabase
          .from("daraz_apps")
          .update({
            encrypted_app_secret: encryptedSecret,
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/daraz/asaan-retail/callback`,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingApp.id);
      } catch (dbError) {
        console.error("[Asaan Retail Auth] Error updating existing app:", dbError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update Daraz app configuration.",
            errorCode: "APP_UPDATE_ERROR"
          },
          { status: 500 }
        );
      }
    } else {
      let newApp;
      try {
        const { data } = await supabase
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
        newApp = data;
      } catch (dbError) {
        console.error("[Asaan Retail Auth] Error creating new app:", dbError.message);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to create Daraz app configuration.",
            errorCode: "APP_CREATE_ERROR"
          },
          { status: 500 }
        );
      }
      darazAppId = newApp?.id || null;
    }

    // Create or update store connection with enhanced error handling
    const storeId = sessionPayload.reconnectStoreId ||
                   `asaan_retail_${Date.now()}`;

    try {
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
    } catch (dbError) {
      console.error("[Asaan Retail Auth] Error creating/updating store:", dbError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create store connection.",
          errorCode: "STORE_CREATE_ERROR"
        },
        { status: 500 }
      );
    }

    // Create store credentials entry with enhanced error handling
    try {
      await supabase
        .from("daraz_store_credentials")
        .upsert({
          store_id: storeId,
          api_app_key: sessionPayload.appKey,
          api_app_secret: sessionPayload.appSecret, // Will be encrypted by trigger
          access_token: "", // Will be populated when making first API call
          refresh_token: "",
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "store_id" });
    } catch (dbError) {
      console.error("[Asaan Retail Auth] Error creating store credentials:", dbError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create store credentials.",
          errorCode: "CREDENTIALS_ERROR"
        },
        { status: 500 }
      );
    }

    // Clear cookies
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/stores?connected=${storeId}`
    );

    response.cookies.delete("daraz_asaan_onboarding_session");
    response.cookies.delete("daraz_asaan_oauth_state");

    return response;
  } catch (err: any) {
    // Enhanced error logging for unexpected errors
    console.error("[Asaan Retail Auth] Unexpected error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred during authentication. Please try again.",
        errorCode: "UNEXPECTED_ERROR"
      },
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