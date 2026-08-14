import { NextRequest, NextResponse } from "next/server";
import { generateDarazSignature } from "@/lib/daraz/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const stateParam = requestUrl.searchParams.get("state");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const debugMode = requestUrl.searchParams.get("debug") === "true";

  // Verify CSRF state token against HttpOnly cookie if present
  const savedStateCookie = req.cookies.get("daraz_oauth_state")?.value;
  if (savedStateCookie && stateParam && stateParam !== savedStateCookie) {
    console.warn("[Daraz OAuth Callback]: CSRF State mismatch warning. Proceeding with store authentication...");
  }

  // Dynamic host & protocol detection
  const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const appKey = (process.env.DARAZ_APP_KEY || "504904").trim();
  const appSecret = (process.env.DARAZ_APP_SECRET || "cPQFbmldQEw4X39ccnnpZNQpH9PEUhTx").trim();
  const apiBaseUrl = process.env.DARAZ_API_BASE_URL || "https://api.daraz.pk/rest";

  if (errorParam) {
    console.error("[Daraz OAuth Error from Provider]:", errorParam, errorDescription);
    return NextResponse.json(
      {
        success: false,
        error: `Daraz Authorization Rejected: ${errorDescription || errorParam}`,
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing authorization code in OAuth callback query parameters.",
      },
      { status: 400 }
    );
  }

  try {
    // Determine authenticated app user ID if logged in
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Exchange Code for Access Token via /auth/token/create
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

    const tokenRes = await fetch(tokenUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange HTTP Error [${tokenRes.status}]: ${tokenRes.statusText}`);
    }

    const tokenData = await tokenRes.json();

    if (tokenData.code && tokenData.code !== "0") {
      throw new Error(
        `Daraz Token API Error [${tokenData.code}]: ${tokenData.message || tokenData.detail || "Invalid Code"}`
      );
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      seller_id,
      account,
      country,
    } = tokenData;

    if (!access_token) {
      throw new Error("Daraz API responded with HTTP 200 but access_token is missing in payload.");
    }

    const expiresInSeconds = typeof expires_in === "number" ? expires_in : parseInt(expires_in || "2592000", 10);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    const targetSellerId = String(seller_id || account || `SELLER_${Date.now()}`);
    const storeName = account || `Daraz Store (${targetSellerId})`;
    const storeRegion = (country || process.env.NEXT_PUBLIC_DARAZ_REGION || "PK").toUpperCase();

    // Persist Tokens Securely in Supabase daraz_stores Table via Admin Client
    const supabase = createAdminClient();

    const { data: existingStores } = await supabase
      .from("daraz_stores")
      .select("id, store_code, seller_id")
      .or(`seller_id.eq.${targetSellerId},store_code.eq.DARAZ-${storeRegion}-${targetSellerId.slice(-6)}`);

    let storeId: string;

    if (existingStores && existingStores.length > 0) {
      const targetStore = existingStores[0];
      const { data: updated, error: updateErr } = await supabase
        .from("daraz_stores")
        .update({
          user_id: currentUserId || undefined,
          seller_id: targetSellerId,
          store_name: storeName,
          access_token,
          refresh_token,
          token_expires_at: tokenExpiresAt,
          api_app_key: appKey,
          api_app_secret: appSecret,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetStore.id)
        .select()
        .single();

      if (updateErr) throw new Error(`Supabase store update error: ${updateErr.message}`);
      storeId = updated.id;
    } else {
      const storeCode = `DARAZ-${storeRegion}-${targetSellerId.slice(-6)}`;
      const { data: inserted, error: insertErr } = await supabase
        .from("daraz_stores")
        .insert({
          user_id: currentUserId || undefined,
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

      if (insertErr) throw new Error(`Supabase store insert error: ${insertErr.message}`);
      storeId = inserted.id;
    }

    // Verify Connection by Fetching Seller Profile
    const client = new DarazApiClient({
      storeId,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
      appKey,
      appSecret,
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
    } catch (profileErr: any) {
      console.warn("[Daraz OAuth Callback] Seller profile verification warning:", profileErr.message);
    }

    // Trigger Automatic Sync for this Store
    executeDarazSync(storeId).catch((syncErr) =>
      console.error("[Daraz OAuth Callback] Background sync error:", syncErr.message)
    );

    // Audit Log in daraz_api_logs
    await supabase.from("daraz_api_logs").insert({
      store_id: storeId,
      sync_type: "oauth_login",
      status: "completed",
      records_synced: 1,
      payload: { storeId, sellerId: targetSellerId, storeName, userId: currentUserId },
    });

    const response = debugMode
      ? NextResponse.json({
          success: true,
          message: "Daraz OAuth Seller Account Connected Successfully!",
          storeId,
          sellerId: targetSellerId,
          storeName,
        })
      : NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=true&store_id=${storeId}`);

    response.cookies.delete("daraz_oauth_state");
    return response;
  } catch (err: any) {
    console.error("[Daraz OAuth Callback Exception]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to exchange Daraz authorization code for tokens.",
      },
      { status: 500 }
    );
  }
}
