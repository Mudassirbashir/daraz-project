import { NextRequest, NextResponse } from "next/server";
import { generateDarazSignature } from "@/lib/daraz/signature";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { DarazApiClient } from "@/lib/daraz/client";
import { executeDarazSync } from "@/lib/daraz/sync-service";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

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
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`).replace(/\/+$/, "");

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

  // 2. Validate CSRF State Token & Read Session Cookie
  const savedState = req.cookies.get("daraz_oauth_state")?.value;
  if (savedState && stateParam && savedState !== stateParam) {
    console.warn("[Daraz OAuth Callback] CSRF state mismatch detected.");
    return NextResponse.redirect(
      `${baseUrl}/stores?error=invalid_state&message=${encodeURIComponent(
        "OAuth security state validation failed. Possible CSRF or expired session."
      )}`
    );
  }

  // Extract session information if present
  let sessionAppKey: string | null = null;
  let sessionAppSecret: string | null = null;
  let intentStoreId: string | null = null;

  const sessionCookie = req.cookies.get("daraz_onboarding_session")?.value;
  if (sessionCookie) {
    try {
      const rawJson = Buffer.from(sessionCookie, "base64").toString("utf8");
      const parsed = JSON.parse(rawJson);
      if (parsed.appKey) sessionAppKey = parsed.appKey;
      if (parsed.encryptedAppSecret) sessionAppSecret = decryptSecret(parsed.encryptedAppSecret) || parsed.encryptedAppSecret;
      if (parsed.reconnectStoreId) intentStoreId = parsed.reconnectStoreId;
    } catch (_) {
      // Graceful fallback
    }
  }

  // 3. Validate Authorization Code presence
  if (!code || !code.trim()) {
    return NextResponse.redirect(
      `${baseUrl}/stores?error=missing_code&message=${encodeURIComponent(
        "Missing authorization code in OAuth callback query parameters."
      )}`
    );
  }

  if (!intentStoreId && stateParam && stateParam.startsWith("store_")) {
    const parts = stateParam.split("_");
    if (parts.length >= 3) {
      intentStoreId = parts[1];
    }
  }

  const appKey = (sessionAppKey || process.env.DARAZ_APP_KEY || "").trim();
  const appSecret = (sessionAppSecret || process.env.DARAZ_APP_SECRET || "").trim();

  try {
    if (!appKey || !appSecret) {
      console.error("[Daraz OAuth Callback]: Missing DARAZ_APP_KEY or DARAZ_APP_SECRET.");
      return NextResponse.redirect(
        `${baseUrl}/stores?error=missing_credentials&message=${encodeURIComponent(
          "Daraz App Key or App Secret credentials are missing or invalid."
        )}`
      );
    }

    // Determine authenticated app user ID if logged in
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    const currentUserId = user?.id || null;

    // 4. Exchange Code for Access Token via GET /auth/token/create
    const apiPath = "/auth/token/create";
    const timestamp = Date.now().toString();

    const params: Record<string, string> = {
      code: code.trim(),
      app_key: appKey,
      timestamp,
      sign_method: "sha256",
    };

    const signature = await generateDarazSignature(apiPath, params, appSecret);
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

    // Handle Daraz API Errors or Consumed Code
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
      seller_id,
      account,
      country,
    } = tokenData;

    if (!access_token) {
      throw new Error("Daraz API responded with HTTP 200 but access_token is missing in payload.");
    }

    const expiresInSeconds = typeof expires_in === "number" ? expires_in : parseInt(expires_in || "2592000", 10);
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const storeRegion = (country || process.env.NEXT_PUBLIC_DARAZ_REGION || "PK").toUpperCase();

    // 5. Fetch Live Seller Profile First to get verified Seller ID & Official Store Name
    let verifiedSellerId = String(seller_id || account || "").trim();
    let verifiedStoreName = account || "Daraz Store";

    try {
      const tempClient = new DarazApiClient({
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
        appKey,
        appSecret,
      });
      const liveProfile = await tempClient.getStoreProfile();
      if (liveProfile.seller_id && liveProfile.seller_id !== "SELLER_UNKNOWN") {
        verifiedSellerId = liveProfile.seller_id;
      }
      if (liveProfile.name) {
        verifiedStoreName = liveProfile.name;
      }
    } catch (profileErr: any) {
      console.warn("[Daraz OAuth Callback] Live profile verification notice:", profileErr.message);
    }

    // REQUIREMENT: Never invent fallback seller IDs if profile cannot be verified
    if (!verifiedSellerId) {
      throw new Error("Unable to verify official Daraz seller account identity from Seller Center. Authentication aborted.");
    }

    // If intentStoreId was provided for reconnect, verify that seller ID matches or store was inactive
    if (intentStoreId) {
      const { data: intentStore } = await supabase
        .from("daraz_stores")
        .select("id, seller_id, store_name")
        .eq("id", intentStoreId)
        .maybeSingle();

      if (intentStore && intentStore.seller_id && intentStore.seller_id !== verifiedSellerId) {
        console.warn(`[Daraz OAuth Callback] Reconnect seller mismatch: Expected '${intentStore.seller_id}', got '${verifiedSellerId}'`);
        return NextResponse.redirect(
          `${baseUrl}/stores?error=seller_mismatch&message=${encodeURIComponent(
            `Authenticated account (${verifiedStoreName}) does not match existing store account (${intentStore.store_name}). Connection aborted.`
          )}`
        );
      }
    }

    // Encrypt App Secret for secure DB storage at rest
    const encryptedSecretForDb = encryptSecret(appSecret);

    // 6. Compute Deterministic Slot Assignment (1..3)
    let activeStoresList: any[] = [];
    try {
      const { data } = await supabase
        .from("daraz_stores")
        .select("id, slot_number, store_code")
        .eq("is_active", true);

      activeStoresList = data || [];
    } catch (e) {
      // Fallback
    }

    const activeSlots = activeStoresList
      .map((s: any) => s.slot_number)
      .filter((n: any) => typeof n === "number" && n > 0);

    let nextSlot = 1;
    const sortedSlots = Array.from(new Set(activeSlots)).sort((a: any, b: any) => a - b);
    for (const slot of sortedSlots) {
      if (slot === nextSlot) nextSlot++;
      else if (slot > nextSlot) break;
    }

    if (nextSlot > 3) {
      nextSlot = 3;
    }

    // Deterministic Store Code
    const formattedSlot = String(nextSlot).padStart(2, "0");
    let cleanSellerCode = verifiedSellerId;
    if (cleanSellerCode.includes("@")) {
      cleanSellerCode = cleanSellerCode.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "");
    } else {
      cleanSellerCode = cleanSellerCode.replace(/\.(com|pk|net|org)$/i, "").replace(/[^a-zA-Z0-9_-]/g, "");
    }
    if (!cleanSellerCode) {
      cleanSellerCode = formattedSlot;
    }

    const incomingStoreCode = `DARAZ-${storeRegion}-${cleanSellerCode}`;

    // 7. Canonical Store Matching Algorithm: Lookup by intentStoreId or seller_id
    let targetStore: any = null;

    if (intentStoreId) {
      const { data: storeById } = await supabase
        .from("daraz_stores")
        .select("*")
        .eq("id", intentStoreId)
        .maybeSingle();

      if (storeById) targetStore = storeById;
    }

    if (!targetStore) {
      const { data: storeBySellerList } = await supabase
        .from("daraz_stores")
        .select("*")
        .eq("seller_id", verifiedSellerId)
        .order("created_at", { ascending: true });

      if (storeBySellerList && storeBySellerList.length > 0) {
        targetStore = storeBySellerList[0];

        // Relink duplicate stores if present
        if (storeBySellerList.length > 1) {
          const duplicateIds = storeBySellerList.slice(1).map((s) => s.id);
          console.log(`[Daraz OAuth Callback] Relinking data from ${duplicateIds.length} duplicate store(s) to canonical store ${targetStore.id}`);
          await supabase.from("listings").update({ store_id: targetStore.id }).in("store_id", duplicateIds);
          await supabase.from("orders").update({ store_id: targetStore.id }).in("store_id", duplicateIds);
          try { await supabase.from("daraz_products").update({ store_id: targetStore.id }).in("store_id", duplicateIds); } catch (_) {}
          try { await supabase.from("daraz_product_skus").update({ store_id: targetStore.id }).in("store_id", duplicateIds); } catch (_) {}
          try { await supabase.from("inventory").update({ store_id: targetStore.id }).in("store_id", duplicateIds); } catch (_) {}
          try { await supabase.from("sync_runs").update({ store_id: targetStore.id }).in("store_id", duplicateIds); } catch (_) {}
          await supabase.from("daraz_stores").update({ is_active: false, sync_status: "merged_duplicate" }).in("id", duplicateIds);
        }
      }
    }

    const isCurrentlySyncing =
      targetStore &&
      targetStore.sync_status === "syncing" &&
      targetStore.updated_at &&
      Date.now() - new Date(targetStore.updated_at).getTime() < 10 * 60 * 1000;

    let storeId: string;

    const baseUpdateData: Record<string, any> = {
      seller_id: verifiedSellerId,
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
      api_app_key: appKey,
      api_app_secret: encryptedSecretForDb || appSecret,
      is_active: true,
      sync_status: isCurrentlySyncing ? "syncing" : "connected",
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    };

    if (currentUserId) {
      baseUpdateData.user_id = currentUserId;
    }

    if (targetStore) {
      // Reconnect existing seller/store record
      const assignedSlot = (targetStore.is_active && targetStore.slot_number) ? targetStore.slot_number : nextSlot;
      baseUpdateData.slot_number = assignedSlot;
      baseUpdateData.store_name = verifiedStoreName || targetStore.store_name || `Store ${assignedSlot}`;
      baseUpdateData.store_code = targetStore.store_code || incomingStoreCode;

      let updatedStore: any = null;
      try {
        const { data: updated, error: updateErr } = await supabase
          .from("daraz_stores")
          .update(baseUpdateData)
          .eq("id", targetStore.id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        updatedStore = updated;
      } catch (updateErr: any) {
        if (updateErr.message?.includes("slot_number")) {
          const { slot_number, ...dataWithoutSlot } = baseUpdateData;
          const { data: updatedFallback, error: fallbackUpdateErr } = await supabase
            .from("daraz_stores")
            .update(dataWithoutSlot)
            .eq("id", targetStore.id)
            .select()
            .single();

          if (fallbackUpdateErr) throw new Error(`Supabase store update error: ${fallbackUpdateErr.message}`);
          updatedStore = updatedFallback;
        } else {
          throw new Error(`Supabase store update error: ${updateErr.message}`);
        }
      }
      storeId = updatedStore.id;
    } else {
      // New store connection -> Enforce 3 Active Store Limit
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

      const insertPayload: Record<string, any> = {
        ...baseUpdateData,
        slot_number: nextSlot,
        store_name: verifiedStoreName || `Store ${nextSlot}`,
        store_code: incomingStoreCode,
        region: storeRegion,
      };

      let insertedStore: any = null;
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from("daraz_stores")
          .insert(insertPayload)
          .select()
          .single();

        if (insertErr) {
          if (insertErr.message?.includes("duplicate key") || insertErr.code === "23505") {
            const { data: existingConflict } = await supabase
              .from("daraz_stores")
              .select("*")
              .or(`seller_id.eq.${verifiedSellerId},store_code.eq.${incomingStoreCode}`)
              .maybeSingle();

            if (existingConflict) {
              const { data: updatedConflict } = await supabase
                .from("daraz_stores")
                .update(insertPayload)
                .eq("id", existingConflict.id)
                .select()
                .single();

              insertedStore = updatedConflict || existingConflict;
            } else {
              throw insertErr;
            }
          } else {
            throw insertErr;
          }
        } else {
          insertedStore = inserted;
        }
      } catch (insertErr: any) {
        if (insertErr.message?.includes("slot_number")) {
          const { slot_number, ...payloadWithoutSlot } = insertPayload;
          const { data: insertedFallback, error: fallbackErr } = await supabase
            .from("daraz_stores")
            .insert(payloadWithoutSlot)
            .select()
            .single();

          if (fallbackErr) throw new Error(`Supabase store insert error: ${fallbackErr.message}`);
          insertedStore = insertedFallback;
        } else {
          throw new Error(`Supabase store insert error: ${insertErr.message}`);
        }
      }
      storeId = insertedStore.id;
    }

    // 8. Trigger Initial Background Sync
    if (!isCurrentlySyncing) {
      console.log(`[Daraz OAuth Callback] Triggering initial sync for store ${storeId}...`);
      executeDarazSync(storeId).catch((syncErr: any) => {
        console.error(`[Daraz OAuth Callback Background Sync Error]:`, syncErr.message);
      });
    }

    const response = debugMode
      ? NextResponse.json({
          success: true,
          message: "Daraz OAuth Seller Account Connected Successfully!",
          storeId,
          sellerId: verifiedSellerId,
          storeName: verifiedStoreName,
        })
      : NextResponse.redirect(`${baseUrl}/stores?connected=true&store_id=${storeId}`);

    response.cookies.delete("daraz_oauth_state");
    response.cookies.delete("daraz_onboarding_session");
    return response;
  } catch (err: any) {
    console.error("[Daraz OAuth Callback Exception]:", err.message);
    const exactErrorMsg = encodeURIComponent(err.message || "Daraz store authorization failed.");
    return NextResponse.redirect(`${baseUrl}/stores?error=oauth_failed&message=${exactErrorMsg}`);
  }
}
