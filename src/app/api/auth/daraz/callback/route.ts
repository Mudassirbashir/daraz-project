import { NextRequest, NextResponse } from "next/server";
import { generateDarazSignature } from "@/lib/daraz/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient } from "@/lib/daraz/client";
import { executeDarazSync } from "@/lib/daraz/sync-service";

export const dynamic = "force-dynamic";

function maskSecret(val?: string, visibleChars = 6): string {
  if (!val) return "[MISSING]";
  if (val.length <= visibleChars) return "***";
  return `${val.slice(0, visibleChars)}...${val.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const stateParam = requestUrl.searchParams.get("state");
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const debugMode = requestUrl.searchParams.get("debug") === "true";

  // Verify CSRF state token against HttpOnly cookie
  const savedStateCookie = req.cookies.get("daraz_oauth_state")?.value;
  if (savedStateCookie && stateParam !== savedStateCookie) {
    console.error("[Daraz OAuth Callback]: CSRF State mismatch detected.");
    return NextResponse.json(
      { success: false, error: "Security Error: OAuth CSRF state verification failed." },
      { status: 400 }
    );
  }

  // Dynamic host & protocol detection for Serverless Functions
  const protocol = req.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || requestUrl.host;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
  const redirectUri = `${baseUrl}/api/auth/daraz/callback`;

  // Read environment variables securely without fallback leaks
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appKey = process.env.DARAZ_APP_KEY;
  const appSecret = process.env.DARAZ_APP_SECRET;
  const apiBaseUrl = process.env.DARAZ_API_BASE_URL || "https://api.daraz.pk/rest";

  const envAudit = {
    NEXT_PUBLIC_SUPABASE_URL: maskSecret(supabaseUrl, 15),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskSecret(supabaseAnonKey, 10),
    SUPABASE_SERVICE_ROLE_KEY: maskSecret(serviceRoleKey, 10),
    DARAZ_APP_KEY: appKey ? appKey : "[MISSING]",
    DARAZ_APP_SECRET: maskSecret(appSecret, 6),
    baseUrl,
    redirectUri,
  };

  const diagnostics: Record<string, any> = {
    step: "init",
    receivedUrl: req.url,
    envAudit,
    hasCode: Boolean(code),
    codeSnippet: code ? `${code.slice(0, 8)}...` : null,
    errorParam,
    errorDescription,
    timestamp: new Date().toISOString(),
  };

  // 1. Validate Environment Variables
  if (!supabaseUrl) {
    return NextResponse.json(
      { success: false, error: "Environment Error: NEXT_PUBLIC_SUPABASE_URL is missing.", diagnostics },
      { status: 500 }
    );
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: "Environment Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required on server.", diagnostics },
      { status: 500 }
    );
  }

  if (!appKey || !appSecret) {
    return NextResponse.json(
      { success: false, error: "Environment Error: DARAZ_APP_KEY and DARAZ_APP_SECRET environment variables are required on server.", diagnostics },
      { status: 500 }
    );
  }

  // 2. Handle OAuth Provider Errors
  if (errorParam) {
    diagnostics.step = "oauth_provider_error";
    console.error("[Daraz OAuth Error from Provider]:", errorParam, errorDescription);
    return NextResponse.json(
      {
        success: false,
        error: `Daraz Authorization Rejected: ${errorDescription || errorParam}`,
        diagnostics,
      },
      { status: 400 }
    );
  }

  if (!code) {
    diagnostics.step = "missing_code";
    return NextResponse.json(
      {
        success: false,
        error: "Missing authorization code in OAuth callback query parameters.",
        diagnostics,
      },
      { status: 400 }
    );
  }

  try {
    // 3. Exchange Authorization Code for Access Token via /auth/token/create
    diagnostics.step = "token_exchange_request";
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

    diagnostics.tokenResponseStatus = tokenRes.status;
    diagnostics.tokenResponseStatusText = tokenRes.statusText;

    const tokenData = await tokenRes.json();
    diagnostics.tokenData = tokenData;

    if (!tokenRes.ok) {
      throw new Error(`Token exchange HTTP Error [${tokenRes.status}]: ${tokenRes.statusText}`);
    }

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

    diagnostics.parsedToken = {
      hasAccessToken: Boolean(access_token),
      hasRefreshToken: Boolean(refresh_token),
      expiresInSeconds,
      tokenExpiresAt,
      sellerId: targetSellerId,
      account,
      storeRegion,
    };

    // 4. Persist Tokens Securely in Supabase daraz_stores Table via Admin Client
    diagnostics.step = "supabase_upsert";
    const supabase = createAdminClient();

    const { data: existingStores } = await supabase
      .from("daraz_stores")
      .select("id, store_code, seller_id")
      .or(`seller_id.eq.${targetSellerId},store_code.eq.DARAZ-${storeRegion}-01`);

    let storeId: string;
    let dbAction = "none";

    if (existingStores && existingStores.length > 0) {
      const targetStore = existingStores[0];
      const { data: updated, error: updateErr } = await supabase
        .from("daraz_stores")
        .update({
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
      dbAction = "updated";
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

      if (insertErr) throw new Error(`Supabase store insert error: ${insertErr.message}`);
      storeId = inserted.id;
      dbAction = "inserted";
    }

    diagnostics.dbResult = { storeId, dbAction };

    // 5. Verify Connection by Fetching Seller Profile
    diagnostics.step = "seller_profile_verification";
    const client = new DarazApiClient({
      storeId,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiresAt,
    });

    try {
      const liveProfile = await client.getStoreProfile();
      diagnostics.liveProfile = liveProfile;

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
      diagnostics.profileWarning = profileErr.message;
    }

    // 6. Trigger Automatic Sync
    executeDarazSync().catch((syncErr) =>
      console.error("[Daraz OAuth Callback] Background sync error:", syncErr.message)
    );

    // Audit Log in daraz_api_logs
    await supabase.from("daraz_api_logs").insert({
      store_id: storeId,
      sync_type: "oauth_login",
      status: "completed",
      records_synced: 1,
      payload: diagnostics,
    });

    const response = debugMode
      ? NextResponse.json({
          success: true,
          message: "Daraz OAuth Seller Account Connected Successfully!",
          storeId,
          sellerId: targetSellerId,
          storeName,
          diagnostics,
        })
      : NextResponse.redirect(`${baseUrl}/dashboard?oauth_success=true&store_id=${storeId}`);

    // Clear OAuth state cookie after successful verification
    response.cookies.delete("daraz_oauth_state");
    return response;
  } catch (err: any) {
    diagnostics.step = "exception";
    diagnostics.errorMessage = err.message || String(err);
    console.error("[Daraz OAuth Callback Exception]:", err);

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to exchange Daraz authorization code for tokens.",
        diagnostics,
      },
      { status: 500 }
    );
  }
}
