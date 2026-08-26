import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDarazClient } from "@/lib/daraz/client";

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

    const { data: creds, error: credsError } = await supabase
      .from("daraz_store_credentials")
      .select("access_token, refresh_token, token_expires_at")
      .eq("store_id", storeId)
      .single();

    if (credsError || !creds) {
      return NextResponse.json(
        { success: false, error: "Store credentials not found" },
        { status: 404 }
      );
    }

    if (!creds.refresh_token) {
      return NextResponse.json(
        { success: false, error: "No refresh token available for this store" },
        { status: 400 }
      );
    }

    const darazClient = await getDarazClient(storeId);
    await darazClient.refreshTokenIfNeeded();

    const accessToken = darazClient.getAccessToken() || creds.access_token;
    const refreshToken = darazClient.getRefreshToken() || creds.refresh_token;
    const tokenExpiresAt =
      darazClient.getTokenExpiresAtIso() || creds.token_expires_at;

    const { error: updateCredsError } = await supabase
      .from("daraz_store_credentials")
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: darazClient.getTokenExpiresAtIso() || creds.token_expires_at,
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
      expiresAt: tokenExpiresAt || undefined,
    });
  } catch (err: any) {
    console.error("[Asaan Retail Token Refresh] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to refresh token" },
      { status: 500 }
    );
  }
}
