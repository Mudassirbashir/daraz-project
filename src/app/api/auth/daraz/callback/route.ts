import { NextRequest, NextResponse } from "next/server";
import { generateDarazSignature } from "@/lib/daraz/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient } from "@/lib/daraz/client";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (errorParam) {
    console.error("[Daraz OAuth Callback Error]:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/dashboard?oauth_error=${encodeURIComponent(errorDescription || errorParam)}`
    );
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code in OAuth callback." }, { status: 400 });
  }

  const appKey = process.env.DARAZ_APP_KEY;
  const appSecret = process.env.DARAZ_APP_SECRET;
  const apiBaseUrl = process.env.DARAZ_API_BASE_URL || "https://api.daraz.pk/rest";

  if (!appKey || !appSecret) {
    return NextResponse.json({ error: "DARAZ_APP_KEY or DARAZ_APP_SECRET is not configured in .env.local" }, { status: 500 });
  }

  try {
    // 1. Exchange authorization code for access token via /auth/token/create
    const apiPath = "/auth/token/create";
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      code,
      app_key: appKey,
      timestamp,
      sign_method: "sha256",
    };

    const signature = generateDarazSignature(apiPath, params, appSecret);
    params.sign = signature;

    const queryString = new URLSearchParams(params).toString();
    const tokenUrl = `${apiBaseUrl}${apiPath}?${queryString}`;

    console.log("[Daraz OAuth Callback] Exchanging code for tokens at:", tokenUrl);

    const tokenRes = await fetch(tokenUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange HTTP Error [${tokenRes.status}]: ${tokenRes.statusText}`);
    }

    const tokenData = await tokenRes.json();

    if (tokenData.code && tokenData.code !== "0") {
      throw new Error(`Daraz Token Exchange Error [${tokenData.code}]: ${tokenData.message || tokenData.detail || "Invalid code"}`);
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      seller_id,
      account,
      country,
    } = tokenData;

    const expiresInSeconds = typeof expires_in === "number" ? expires_in : parseInt(expires_in || "2592000", 10);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const targetSellerId = seller_id || account || `SELLER_${Date.now()}`;
    const storeName = account || `Daraz Store (${targetSellerId})`;
    const storeRegion = (country || process.env.NEXT_PUBLIC_DARAZ_REGION || "PK").toUpperCase();

    // 2. Persist Tokens Securely in Supabase daraz_stores Table
    const supabase = createAdminClient();

    const { data: existingStore } = await supabase
      .from("daraz_stores")
      .select("id")
      .eq("seller_id", targetSellerId)
      .single();

    let storeId: string;

    if (existingStore) {
      const { data: updated, error: updateErr } = await supabase
        .from("daraz_stores")
        .update({
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          api_app_key: appKey,
          api_app_secret: appSecret,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingStore.id)
        .select()
        .single();

      if (updateErr) throw new Error(`Failed to update tokens in database: ${updateErr.message}`);
      storeId = updated.id;
    } else {
      const storeCode = `DARAZ-${storeRegion}-${targetSellerId.slice(-6)}`;
      const { data: inserted, error: insertErr } = await supabase
        .from("daraz_stores")
        .insert({
          store_code: storeCode,
          store_name: storeName,
          region: storeRegion,
          seller_id: targetSellerId,
          api_app_key: appKey,
          api_app_secret: appSecret,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) throw new Error(`Failed to store credentials in database: ${insertErr.message}`);
      storeId = inserted.id;
    }

    // 3. Fetch Live Seller Information using newly acquired Access Token
    console.log("[Daraz OAuth Callback] Fetching live seller profile for store:", storeId);
    const client = new DarazApiClient({
      storeId,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    });

    try {
      const liveProfile = await client.getStoreProfile();
      await supabase
        .from("daraz_stores")
        .update({
          store_name: liveProfile.name,
          seller_id: liveProfile.seller_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", storeId);
      console.log("[Daraz OAuth Callback] Live seller info fetched successfully:", liveProfile.name);
    } catch (sellerErr: any) {
      console.warn("[Daraz OAuth Callback] Seller profile fetch warning:", sellerErr.message);
    }

    // 4. Trigger Automatic Live Data Synchronization
    executeDarazSync().catch((syncErr) =>
      console.error("[Daraz OAuth Callback] Background sync error:", syncErr.message)
    );

    // Log OAuth completion event
    await supabase.from("daraz_api_logs").insert({
      store_id: storeId,
      sync_type: "oauth_login",
      status: "completed",
      records_synced: 1,
      payload: {
        seller_id: targetSellerId,
        store_name: storeName,
        expires_at: tokenExpiresAt,
      },
    });

    return NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=true`);
  } catch (err: any) {
    console.error("[Daraz OAuth Exchange Exception]:", err.message);
    return NextResponse.redirect(
      `${baseUrl}/dashboard?oauth_error=${encodeURIComponent(err.message)}`
    );
  }
}
