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

    // 3. Exchange Code for Access Token via /auth/token/create
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

    console.log(`[Daraz OAuth Callback] Exchanging authorization code for tokens via ${tokenUrl.split("?")[0]}...`);

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Fall back to GET if POST request returns unsupported method
    let tokenData: any;
    if (!tokenRes.ok) {
      console.warn(`[Daraz OAuth Callback] POST token exchange returned HTTP ${tokenRes.status}. Retrying with GET...`);
      const getRes = await fetch(tokenUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!getRes.ok) {
        throw new Error(`Token exchange HTTP Error [${getRes.status}]: ${getRes.statusText}`);
      }
      tokenData = await getRes.json();
    } else {
      tokenData = await tokenRes.json();
    }

    // 4. Handle Consumed or Expired Authorization Code gracefully
    if (tokenData.code && tokenData.code !== "0") {
      const errCode = String(tokenData.code);
      const errMsg = tokenData.message || tokenData.detail || "Invalid Code";

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
            "Daraz authorization session expired or code was already used. Please connect again."
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

    // 5. Store Persistence & Reconnection Check
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
      // Reconnect existing seller record
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
      let storeQuery = supabase.from("daraz_stores").select("id", { count: "exact", head: true }).eq("is_active", true);
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

    // 7. Initial Sync Execution
    try {
      console.log(`[Daraz OAuth Callback] Starting initial store sync for storeId ${storeId}...`);
      await executeDarazSync(storeId);
    } catch (syncErr: any) {
      console.error(`[Daraz OAuth Callback] Initial store sync notice for ${storeId}:`, syncErr.message);
    }

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
    const friendlyError = encodeURIComponent(
      err.message?.includes("Maximum 3")
        ? err.message
        : "Daraz store authorization could not be completed. Please try connecting again."
    );
    return NextResponse.redirect(`${baseUrl}/stores?error=oauth_failed&message=${friendlyError}`);
  }
}
