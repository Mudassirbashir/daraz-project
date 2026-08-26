import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/encryption";

/**
 * Exchange Daraz App Key/Secret for access/refresh tokens using active session
 * This endpoint should be called from the client-side where Daraz session cookies are available
 * POST /api/daraz/asaan-retail/exchange-token
 * Body: { state: string }
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

    // Validate session payload
    if (!sessionPayload.appKey || !sessionPayload.encryptedAppSecret) {
      return NextResponse.json(
        { success: false, error: "Invalid session payload" },
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

    // For Asaan Retail-style token exchange, we would typically:
    // 1. Make a request to Daraz API using the user's active session (browser cookies)
    // 2. Exchange App Key/Secret for tokens
    //
    // However, since we're on the server and don't have access to browser cookies,
    // we need to rely on the client-side to make this exchange.
    //
    // This endpoint serves as a placeholder/validation endpoint.
    // The actual token exchange should happen client-side using fetch with credentials: 'include'
    // to send the Daraz session cookies, then calling our backend to store the tokens.

    // For now, we'll return the app credentials so the client can use them
    // In a real implementation, the client would:
    // 1. Get appKey/appSecret from this endpoint or session storage
    // 2. Make a call to Daraz API with credentials: 'include' to get tokens using their session
    // 3. Send those tokens back to our backend to store

    const appKey = sessionPayload.appKey;
    const appSecret = decryptSecret(sessionPayload.encryptedAppSecret) || sessionPayload.encryptedAppSecret;

    // Determine store ID
    const storeId = sessionPayload.reconnectStoreId ||
                   `asaan_retail_${Date.now()}`;

    return NextResponse.json({
      success: true,
      message: "Ready for token exchange. Please make a client-side call to Daraz API with your active session to obtain tokens, then call the token storage endpoint.",
      appKey,
      storeId,
      // Note: We don't return the appSecret for security reasons
      // The client should have already received it during the onboarding process
      requiresClientSideExchange: true
    });

  } catch (err: any) {
    console.error("[Asaan Retail Token Exchange] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to prepare for token exchange" },
      { status: 500 }
    );
  }
}