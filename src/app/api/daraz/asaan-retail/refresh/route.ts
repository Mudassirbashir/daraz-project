import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient } from "@/lib/daraz/client";

/**
 * Refresh token for Asaan Retail-style Daraz connection
 * POST /api/daraz/asaan-retail/refresh
 * Body: { storeId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { storeId } = await req.json();

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: "Store ID is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get store credentials
    const { data: creds, error: credsError } = await supabase
      .from("daraz_store_credentials")
      .select("*")
      .eq("store_id", storeId)
      .single();

    if (credsError || !creds) {
      return NextResponse.json(
        { success: false, error: "Store credentials not found" },
        { status: 404 }
      );
    }

    // Check if we have a refresh token
    if (!creds.refresh_token) {
      return NextResponse.json(
        { success: false, error: "No refresh token available for this store" },
        { status: 400 }
      );
    }

    // Get store details to construct Daraz client
    const { data: store, error: storeError } = await supabase
      .from("daraz_stores")
      .select("id, daraz_app_id, region")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { success: false, error: "Store not found" },
        { status: 404 }
      );
    }

    // Get app credentials
    let appKey = creds.api_app_key;
    let appSecret = creds.api_app_secret; // This is encrypted, need to decrypt

    if (!appKey) {
      // Try to get from daraz_apps if store has daraz_app_id
      if (store.daraz_app_id) {
        const { data: appData, error: appError } = await supabase
          .from("daraz_apps")
          .select("app_key, encrypted_app_secret")
          .eq("id", store.daraz_app_id)
          .single();

        if (!appError && appData) {
          appKey = appData.app_key;
          // Note: appSecret is already decrypted in the DarazClient constructor
          // but we need to decrypt it here for the refresh call
          // Actually, let's just pass the encrypted version and let DarazClient handle it
          appSecret = appData.encrypted_app_secret;
        }
      }
    }

    // Fallback to environment variables
    if (!appKey) appKey = process.env.DARAZ_APP_KEY || "";
    if (!appSecret) appSecret = process.env.DARAZ_APP_SECRET || "";

    if (!appKey || !appSecret) {
      return NextResponse.json(
        { success: false, error: "Daraz application credentials not configured" },
        { status: 500 }
      );
    }

    // Create Daraz client and refresh token
    const darazClient = new DarazApiClient({
      storeId: storeId,
      appKey: appKey,
      appSecret: appSecret,
      countryCode: (store.region || 'PK') as 'PK' | 'BD' | 'LK' | 'NP' | 'MM',
      accessToken: creds.access_token,
      refreshToken: creds.refresh_token,
      tokenExpiresAt: creds.token_expires_at,
    });

    // Perform token refresh
    await darazClient.refreshTokenIfNeeded();

    // Get updated tokens
    const { data: updatedCreds, error: updateError } = await supabase
      .from("daraz_store_credentials")
      .select("access_token, refresh_token, token_expires_at")
      .eq("store_id", storeId)
      .single();

    if (updateError || !updatedCreds) {
      return NextResponse.json(
        { success: false, error: "Failed to retrieve updated credentials" },
        { status: 500 }
      );
    }

    // Update the credentials with new tokens
    const { error: updateCredsError } = await supabase
      .from("daraz_store_credentials")
      .update({
        access_token: darazClient.accessToken || updatedCreds.access_token,
        refresh_token: darazClient.refreshToken || updatedCreds.refresh_token,
        token_expires_at: darazClient.tokenExpiresAt?.toISOString() || updatedCreds.token_expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId);

    if (updateCredsError) {
      console.error("[Asaan Retail Token Refresh] Error updating credentials:", updateCredsError);
      return NextResponse.json(
        { success: false, error: "Failed to update token credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
      accessToken: darazClient.accessToken,
      expiresAt: darazClient.tokenExpiresAt?.toISOString() || undefined
    });

  } catch (err: any) {
    console.error("[Asaan Retail Token Refresh] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to refresh token" },
      { status: 500 }
    );
  }
}