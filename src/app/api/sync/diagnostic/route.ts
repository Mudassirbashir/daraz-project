import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidStoreAccessToken } from "@/lib/daraz/store-utils";
import {
  requireAuthenticatedUser,
  requireAuthorizedStore,
  getAuthorizedStoreIds,
} from "@/lib/api/auth-guard";

export const dynamic = "force-dynamic";

export interface DiagnosticStage {
  stage: "STORE" | "AUTH" | "API" | "DATABASE" | "SYNC";
  status: "PASSED" | "FAILED";
  details: string[];
  error?: string | null;
}

export interface SyncDiagnosticReport {
  success: boolean;
  storeId?: string;
  storeCode?: string;
  storeName?: string;
  failedStage?: string | null;
  failureReason?: string | null;
  stages: DiagnosticStage[];
  summaryText: string;
  metrics: {
    ordersFetched: number;
    ordersUpserted: number;
    listingsFetched: number;
    listingsUpserted: number;
    inventoryFetched: number;
    inventoryUpserted: number;
  };
  durationMs: number;
  timestamp: string;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser(req, { permission: "sync:read" });
  if (!auth.ok) return auth.response;

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const url = new URL(req.url);
  const storeId = url.searchParams.get("store_id") || url.searchParams.get("id");

  const supabase = createAdminClient();
  const stages: DiagnosticStage[] = [];
  const detailsText: string[] = [];

  let currentStage: "STORE" | "AUTH" | "API" | "DATABASE" | "SYNC" = "STORE";
  let ordersFetched = 0;
  let ordersUpserted = 0;
  let listingsFetched = 0;
  let listingsUpserted = 0;
  let inventoryFetched = 0;
  let inventoryUpserted = 0;

  try {
    // ── STAGE 1: STORE ───────────────────────────────────────────────────────
    currentStage = "STORE";
    const storeStageDetails: string[] = [];

    let targetStore: any = null;
    if (storeId) {
      const storeAuth = await requireAuthorizedStore(auth.principal, storeId);
      if (!storeAuth.ok) return storeAuth.response;
      targetStore = storeAuth.store;
    } else {
      const authorizedIds = await getAuthorizedStoreIds(auth.principal);
      if (authorizedIds.length === 0) {
        throw new Error("No active Daraz stores authorized for user.");
      }
      const { data: sList } = await supabase
        .from("daraz_stores")
        .select("*")
        .in("id", authorizedIds)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      if (!sList || sList.length === 0) {
        throw new Error("No active Daraz stores configured in system.");
      }
      targetStore = sList[0];
    }

    storeStageDetails.push(`✓ Store found (ID: ${targetStore.id})`);

    if (!targetStore.is_active) {
      throw new Error(`Store '${targetStore.store_name}' is set to inactive.`);
    }
    storeStageDetails.push(`✓ Store active (${targetStore.store_name} / ${targetStore.store_code})`);

    const { data: creds, error: credsErr } = await supabase
      .from("daraz_store_credentials")
      .select("*")
      .eq("store_id", targetStore.id)
      .maybeSingle();

    if (credsErr || !creds) {
      throw new Error(`Credentials record missing in daraz_store_credentials for store ${targetStore.id}`);
    }
    storeStageDetails.push("✓ Credentials record found in daraz_store_credentials");

    stages.push({
      stage: "STORE",
      status: "PASSED",
      details: storeStageDetails,
    });

    // ── STAGE 2: AUTH ────────────────────────────────────────────────────────
    currentStage = "AUTH";
    const authStageDetails: string[] = [];

    if (!creds.access_token || !creds.access_token.trim()) {
      throw new Error("Access token missing in daraz_store_credentials");
    }
    authStageDetails.push("✓ Access token available");

    const expiresAt = new Date(creds.token_expires_at || 0).getTime();
    const isExpired = Date.now() >= expiresAt;
    authStageDetails.push(isExpired ? "! Token expired (will execute refresh)" : "✓ Token valid");

    const authRes = await getValidStoreAccessToken(targetStore.id);
    const client = authRes.client;
    authStageDetails.push("✓ Daraz authentication & client initialization successful");

    stages.push({
      stage: "AUTH",
      status: "PASSED",
      details: authStageDetails,
    });

    // ── STAGE 3: API ─────────────────────────────────────────────────────────
    currentStage = "API";
    const apiStageDetails: string[] = [];

    let catalogSample: any = null;
    try {
      catalogSample = await client.getCatalogItems(0, 5, "all");
      listingsFetched = catalogSample.items.length;
      inventoryFetched = catalogSample.items.length;
      apiStageDetails.push(`✓ Products endpoint called (/products/get): ${catalogSample.total_items} total reported, ${catalogSample.items.length} sampled`);
    } catch (catErr: any) {
      throw new Error(`Products endpoint failed (/products/get): ${catErr.message}`);
    }

    let ordersSample: any = null;
    try {
      ordersSample = await client.getOrders(0, 5);
      ordersFetched = ordersSample.orders.length;
      apiStageDetails.push(`✓ Orders endpoint called (/orders/get): ${ordersSample.total} total reported, ${ordersSample.orders.length} sampled`);
    } catch (ordErr: any) {
      throw new Error(`Orders endpoint failed (/orders/get): ${ordErr.message}`);
    }

    stages.push({
      stage: "API",
      status: "PASSED",
      details: apiStageDetails,
    });

    // ── STAGE 4: DATABASE ────────────────────────────────────────────────────
    currentStage = "DATABASE";
    const dbStageDetails: string[] = [];

    // Verify DB count metrics for target store
    const [
      { count: dbOrdersCount, error: oCountErr },
      { count: dbListingsCount, error: lCountErr },
      { count: dbInventoryCount, error: iCountErr },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", targetStore.id),
      supabase.from("listings").select("*", { count: "exact", head: true }).eq("store_id", targetStore.id),
      supabase.from("inventory").select("*", { count: "exact", head: true }).eq("store_id", targetStore.id),
    ]);

    if (oCountErr) throw new Error(`Orders table query failed: ${oCountErr.message}`);
    if (lCountErr) throw new Error(`Listings table query failed: ${lCountErr.message}`);
    if (iCountErr) throw new Error(`Inventory table query failed: ${iCountErr.message}`);

    ordersUpserted = dbOrdersCount || 0;
    listingsUpserted = dbListingsCount || 0;
    inventoryUpserted = dbInventoryCount || 0;

    dbStageDetails.push(`✓ Orders stored: ${ordersUpserted}`);
    dbStageDetails.push(`✓ Listings stored: ${listingsUpserted}`);
    dbStageDetails.push(`✓ Inventory records stored: ${inventoryUpserted}`);

    stages.push({
      stage: "DATABASE",
      status: "PASSED",
      details: dbStageDetails,
    });

    // ── STAGE 5: SYNC ────────────────────────────────────────────────────────
    currentStage = "SYNC";
    const syncStageDetails: string[] = [];
    const durationMs = Date.now() - startTime;

    syncStageDetails.push(`✓ Diagnostic started at ${timestamp}`);
    syncStageDetails.push(`✓ Diagnostic completed in ${durationMs} ms`);

    stages.push({
      stage: "SYNC",
      status: "PASSED",
      details: syncStageDetails,
    });

    const summaryText = [
      `STORE\n${storeStageDetails.join("\n")}`,
      `AUTH\n${authStageDetails.join("\n")}`,
      `API\n${apiStageDetails.join("\n")}`,
      `DATABASE\n${dbStageDetails.join("\n")}`,
      `SYNC\n${syncStageDetails.join("\n")}`,
    ].join("\n\n");

    const report: SyncDiagnosticReport = {
      success: true,
      storeId: targetStore.id,
      storeCode: targetStore.store_code,
      storeName: targetStore.store_name,
      failedStage: null,
      failureReason: null,
      stages,
      summaryText,
      metrics: {
        ordersFetched,
        ordersUpserted,
        listingsFetched,
        listingsUpserted,
        inventoryFetched,
        inventoryUpserted,
      },
      durationMs,
      timestamp,
    };

    return NextResponse.json(report);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const reason = err.message || "Diagnostic step failed.";

    stages.push({
      stage: currentStage,
      status: "FAILED",
      details: [`✗ FAILED: ${reason}`],
      error: reason,
    });

    const summaryText = `✗ FAILED\nReason: ${reason}\nStage: ${currentStage}`;

    const failureReport: SyncDiagnosticReport = {
      success: false,
      failedStage: currentStage,
      failureReason: reason,
      stages,
      summaryText,
      metrics: {
        ordersFetched,
        ordersUpserted,
        listingsFetched,
        listingsUpserted,
        inventoryFetched,
        inventoryUpserted,
      },
      durationMs,
      timestamp,
    };

    return NextResponse.json(failureReport, { status: 400 });
  }
}
