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

  // 1. Handle OAuth Error from Daraz Provider
  if (errorParam) {
    console.error("[Daraz OAuth Error from Provider]:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${baseUrl}/stores?error=oauth_rejected&message=${encodeURIComponent(
        `Daraz Authorization Rejected: ${errorDescription || errorParam}`
      )}`
    );
  }

  // 2. Validate Authorization Code presence
  if (!code || !code.trim()) {
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

    // 3. Exchange Code for Access Token via GET /auth/token/create
    const apiPath = "/auth/token/create";
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      code: code.trim(),
      app_key: appKey,
      timestamp,
      sign_method: "sha256",
    };

    const signature = generateDarazSignature(apiPath, params, appSecret);
    params.sign = signature;

    const queryString = new URLSearchParams(params).toString();
    const tokenUrl = `${apiBaseUrl}${apiPath}?${queryString}`;

    console.log(`[Daraz OAuth Callback] Initiating token exchange for app_key '${appKey}' code '${code.slice(0, 8)}...'`);

    const tokenRes = await fetch(tokenUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    const tokenResText = await tokenRes.text();
    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenResText);
    } catch (parseErr) {
      console.error(`[Daraz OAuth Callback] Non-JSON response from token endpoint (HTTP ${tokenRes.status}):`, tokenResText);
      throw new Error(`Daraz Token API HTTP ${tokenRes.status}: ${tokenResText.slice(0, 150)}`);
    }

    console.log(`[Daraz OAuth Callback] Token API Response Status: ${tokenRes.status}, Response Code: ${tokenData.code || "0"}`);

    // 4. Handle Daraz API Errors or Consumed Code
    if (tokenData.code && tokenData.code !== "0") {
      const errCode = String(tokenData.code);
      const errMsg = tokenData.message || tokenData.detail || tokenData.msg || tokenData.sub_message || `Error ${errCode}`;

      if (
        errCode === "InvalidCode" ||
        errCode === "15" ||
        errMsg.toLowerCase().includes("invalid authorization code") ||
        errMsg.toLowerCase().includes("code expired")
      ) {
        console.warn(`[Daraz OAuth Callback] Authorization code was already consumed or expired.`);

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
          return NextResponse.redirect(`${baseUrl}/stores?connected=true&store_id=${existingConnected.id}`);
        }

        return NextResponse.redirect(
          `${baseUrl}/stores?error=code_expired&message=${encodeURIComponent(
            `Daraz API Error [${errCode}]: ${errMsg}`
          )}`
        );
      }

      throw new Error(`Daraz Token API Error [${errCode}]: ${errMsg}`);
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      refresh_expires_in,
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

    // 5. Store Persistence & Strict Exact seller_id Reconnection Check
    const { data: existingStores } = await supabase
      .from("daraz_stores")
      .select("id, store_code, seller_id, is_active")
      .eq("seller_id", targetSellerId);

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
      // Reconnect existing seller record with exact seller_id match
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
      // New store connection -> Enforce 3-Store Limit!
      let storeQuery = supabase
        .from("daraz_stores")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .not("access_token", "is", null);

      if (currentUserId) {
        storeQuery = storeQuery.or(`user_id.eq.${currentUserId},user_id.is.null`);
      }
      const { count: activeStoreCount } = await storeQuery;

      if ((activeStoreCount || 0) >= 3) {
        return NextResponse.redirect(
          `${baseUrl}/stores?error=limit_reached&message=${encodeURIComponent(
            "Maximum 3 active Daraz stores allowed. Disconnect an existing store before connecting another."
          )}`
        );
      }

      // Generate a unique store code using full targetSellerId to prevent UNIQUE key collisions
      let storeCode = `DARAZ-${storeRegion}-${targetSellerId}`;
      const { data: codeCheck } = await supabase
        .from("daraz_stores")
        .select("id")
        .eq("store_code", storeCode)
        .maybeSingle();

      if (codeCheck) {
        storeCode = `DARAZ-${storeRegion}-${targetSellerId}-${Date.now().toString().slice(-4)}`;
      }

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

    // 6. Verify Seller Profile
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

    // 7. Non-Blocking Async Background Sync Execution
    console.log(`[Daraz OAuth Callback] Triggering non-blocking background sync for storeId ${storeId}...`);
    executeDarazSync(storeId).catch((syncErr: any) => {
      console.error(`[Daraz OAuth Callback Background Sync Notice for ${storeId}]:`, syncErr.message);
    });

    // 8. Log Audit Diagnostic
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
      : NextResponse.redirect(`${baseUrl}/stores?connected=true&store_id=${storeId}`);

    response.cookies.delete("daraz_oauth_state");
    return response;
  } catch (err: any) {
    console.error("[Daraz OAuth Callback Exception]:", err.message);
    const exactErrorMsg = encodeURIComponent(err.message || "Daraz store authorization failed.");
    return NextResponse.redirect(`${baseUrl}/stores?error=oauth_failed&message=${exactErrorMsg}`);
  }
}
