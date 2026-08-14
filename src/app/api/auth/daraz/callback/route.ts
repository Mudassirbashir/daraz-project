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

  // Dynamic host & protocol detection
  const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const appKey = (process.env.DARAZ_APP_KEY || "504904").trim();
  const appSecret = (process.env.DARAZ_APP_SECRET || "cPQFbmldQEw4X39ccnnpZNQpH9PEUhTx").trim();
  const apiBaseUrl = process.env.DARAZ_API_BASE_URL || "https://api.daraz.pk/rest";

  const supabase = createAdminClient();

  if (errorParam) {
    console.error("[Daraz OAuth Error from Provider]:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/stores?error=oauth_rejected&message=${encodeURIComponent(
        `Daraz Authorization Rejected: ${errorDescription || errorParam}`
      )}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/stores?error=missing_code&message=${encodeURIComponent(
        "Missing authorization code in OAuth callback query parameters."
      )}`
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

    // Handle Already-Consumed or Expired Authorization Code gracefully
    if (tokenData.code && tokenData.code !== "0") {
      const errCode = String(tokenData.code);
      const errMsg = tokenData.message || tokenData.detail || "Invalid Code";

      if (
        errCode === "InvalidCode" ||
        errCode === "15" ||
        errMsg.toLowerCase().includes("invalid authorization code") ||
        errMsg.toLowerCase().includes("code expired")
      ) {
        console.warn(`[Daraz OAuth Callback] Code '${code.slice(0, 8)}...' was already consumed or expired.`);

        // Check if an active connected store already exists in DB
        let checkQuery = supabase
          .from("daraz_stores")
          .select("id, store_name")
          .eq("is_active", true)
          .not("access_token", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (currentUserId) {
          checkQuery = checkQuery.or(`user_id.eq.${currentUserId},user_id.is.null`);
        }

        const { data: existingConnected } = await checkQuery.maybeSingle();

        if (existingConnected) {
          return NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=true&store_id=${existingConnected.id}`);
        }

        return NextResponse.redirect(
          `${baseUrl}/stores?error=code_expired&message=${encodeURIComponent(
            "Daraz authorization code expired or was already used. Please connect your store again."
          )}`
        );
      }

      throw new Error(`Daraz Token API Error [${errCode}]: ${errMsg}`);
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

    // Check existing store with matching seller_id to allow reconnection
    const { data: existingStores } = await supabase
      .from("daraz_stores")
      .select("id, store_code, seller_id, is_active")
      .or(`seller_id.eq.${targetSellerId},store_code.eq.DARAZ-${storeRegion}-${targetSellerId.slice(-6)}`);

    let storeId: string;

    const baseUpdateData: Record<string, any> = {
      seller_id: targetSellerId,
      store_name: storeName,
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      api_app_key: appKey,
      api_app_secret: appSecret,
      is_active: true,
      sync_status: "syncing",
      updated_at: new Date().toISOString(),
    };

    if (currentUserId) {
      baseUpdateData.user_id = currentUserId;
    }

    if (existingStores && existingStores.length > 0) {
      // Reconnect / Update Existing Store
      const targetStore = existingStores[0];
      const { data: updated, error: updateErr } = await supabase
        .from("daraz_stores")
        .update(baseUpdateData)
        .eq("id", targetStore.id)
        .select()
        .single();

      if (updateErr) throw new Error(`Supabase store update error: ${updateErr.message}`);
      storeId = updated.id;
    } else {
      // Connecting a NEW store -> Enforce 3-Store Limit!
      let storeQuery = supabase.from("daraz_stores").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (currentUserId) {
        storeQuery = storeQuery.or(`user_id.eq.${currentUserId},user_id.is.null`);
      }
      const { count: activeStoreCount } = await storeQuery;

      if ((activeStoreCount || 0) >= 3) {
        return NextResponse.redirect(
          `${baseUrl}/stores?error=limit_reached&message=${encodeURIComponent(
            "Maximum 3 Daraz stores allowed. Remove an existing store before connecting another."
          )}`
        );
      }

      const storeCode = `DARAZ-${storeRegion}-${targetSellerId.slice(-6)}`;
      const { data: inserted, error: insertErr } = await supabase
        .from("daraz_stores")
        .insert({
          ...baseUpdateData,
          store_code: storeCode,
          region: storeRegion,
        })
        .select()
        .single();

      if (insertErr) throw new Error(`Supabase store insert error: ${insertErr.message}`);
      storeId = inserted.id;
    }

    // Verify Connection & Get Seller Profile
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
      console.warn("[Daraz OAuth Callback] Seller profile verification notice:", profileErr.message);
    }

    // Synchronously await full initial sync so serverless execution container completes ingestion before redirecting
    try {
      console.log(`[Daraz OAuth Callback] Starting synchronous initial store sync for storeId ${storeId}...`);
      const syncResult = await executeDarazSync(storeId);
      console.log(`[Daraz OAuth Callback] Synchronous initial store sync complete for ${storeId}:`, syncResult);
    } catch (syncErr: any) {
      console.error(`[Daraz OAuth Callback] Synchronous initial store sync notice for ${storeId}:`, syncErr.message);
    }

    // Audit Log in daraz_api_logs
    try {
      await supabase.from("daraz_api_logs").insert({
        store_id: storeId,
        sync_type: "oauth_login",
        status: "completed",
        records_synced: 1,
        payload: { storeId, sellerId: targetSellerId, storeName, userId: currentUserId },
      });
    } catch (logErr) {
      // Ignore logging failure
    }

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
    console.error("[Daraz OAuth Callback Exception]:", err.message);
    const friendlyError = encodeURIComponent(
      err.message?.includes("Maximum 3")
        ? err.message
        : "Daraz store authentication could not be completed. Please try connecting again."
    );
    return NextResponse.redirect(`${baseUrl}/stores?error=oauth_failed&message=${friendlyError}`);
  }
}
