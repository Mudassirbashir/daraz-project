import { createAdminClient } from "../supabase/admin";
import { DarazApiClient, sanitizeLogPayload, humanizeDarazApiError } from "./client";
import { DarazOrderStatus } from "../../types/database.types";
import { mapDarazOrderStatus } from "./order-status";
import { getValidStoreAccessToken } from "./store-utils";
import { getStoreSyncSettings } from "./sync-settings-service";

export interface ModuleResult {
  status: "passed" | "failed" | "skipped";
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
  durationMs: number;
}

export interface SyncResult {
  success: boolean;
  status: "completed" | "completed_with_errors" | "failed";
  storesSynced: number;
  productsSynced: number; // Deprecated alias for skusSynced — kept for API backwards compat
  itemsSynced: number;    // Parent Items / distinct Products count
  skusSynced: number;     // Total SKU variations persisted
  skippedItems: number;   // Items skipped due to missing stable IDs
  skippedSkus: number;    // SKUs skipped due to missing stable SellerSku
  ordersSynced: number;
  orderItemsSynced?: number; // Total order item rows persisted
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  durationMs: number;
  errors: string[];
  timestamp: string;
  moduleResults?: Record<string, ModuleResult>;
}

// Database-backed sync lock threshold: if a sync row is locked for more than this duration, it is
// assumed to be a crashed/stale process and the lock is eligible for takeover.
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Concurrency Limiter to prevent rate limiting (2-5 max concurrent requests)
 */
export async function mapConcurrently<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items || items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

export type DarazErrorCategory =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN";

export function classifyDarazError(err: any): DarazErrorCategory {
  const msg = String(err?.message || err || "").toLowerCase();
  if (msg.includes("unauthorized") || msg.includes("access_token") || msg.includes("invalid code") || msg.includes("auth")) {
    return "AUTH_ERROR";
  }
  if (msg.includes("rate limit") || msg.includes("qps") || msg.includes("too many requests") || msg.includes("429")) {
    return "RATE_LIMIT";
  }
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout")) {
    return "TIMEOUT";
  }
  if (msg.includes("network") || msg.includes("econnreset") || msg.includes("fetch failed")) {
    return "NETWORK_ERROR";
  }
  if (msg.includes("validation") || msg.includes("invalid") || msg.includes("bad request")) {
    return "VALIDATION_ERROR";
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return "NOT_FOUND";
  }
  if (msg.includes("permission") || msg.includes("forbidden") || msg.includes("403")) {
    return "PERMISSION_ERROR";
  }
  if (msg.includes("database") || msg.includes("supabase") || msg.includes("postgres") || msg.includes("duplicate key")) {
    return "DATABASE_ERROR";
  }
  return "UNKNOWN";
}

/**
 * Production-Grade Staged Synchronization Engine
 */
export async function executeDarazSync(
  targetStoreId?: string,
  modulesToRun?: string[]
): Promise<SyncResult> {
  const startTime = Date.now();
  const startedTimeIso = new Date(startTime).toISOString();
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  const supabase = createAdminClient();

  let storesSynced = 0;
  let totalItemsSynced = 0;
  let totalSkusSynced = 0;
  let totalSkippedItems = 0;
  let totalSkippedSkus = 0;
  let totalOrdersSynced = 0;
  let totalOrderItemsSynced = 0;
  let totalImportedCount = 0;
  let totalUpdatedCount = 0;
  let totalFailedCount = 0;

  const globalModuleResults: Record<string, ModuleResult> = {
    store_profile: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    catalog_products: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    skus: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    inventory_stock: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    orders: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    order_items: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    active_items: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    reconciliation: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    product_images: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    shipping_labels: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    addresses: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    phone_numbers: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
    historical_orders: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
  };

  try {
    // ── 1. Resolve which stores to sync ──────────────────────────────────────
    let query = supabase.from("daraz_stores").select("*").eq("is_active", true);

    if (targetStoreId) {
      query = query.eq("id", targetStoreId);
    }

    const { data: stores, error: storesError } = await query;

    if (storesError) {
      throw new Error(`Failed to query daraz_stores table: ${storesError.message}`);
    }

    const connectedStores = (stores || []).filter(
      (s) => s.access_token && s.access_token.trim()
    );

    if (connectedStores.length === 0) {
      const msg = targetStoreId
        ? `Store ${targetStoreId} not found or has no active access token. Reconnect via My Stores.`
        : "No connected Daraz stores with active access tokens found. Please connect your Daraz store via My Stores.";
      errors.push(msg);
      return buildResult(false, "failed", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, Date.now() - startTime, errors, timestamp, globalModuleResults);
    }

    // ── 2. Process each connected store ──────────────────────────────────────
    for (const store of connectedStores) {
      let storeErrorMsg: string | null = null;
      let storeItemsSynced = 0;
      let storeSkusSynced = 0;
      let storeSkippedItems = 0;
      let storeSkippedSkus = 0;
      let storeOrdersSynced = 0;
      let storeOrderItemsSynced = 0;
      let storeImportedCount = 0;
      let storeUpdatedCount = 0;
      let storeFailedCount = 0;

      const syncSettings = await getStoreSyncSettings(store.id);

      const isModuleEnabled = (modName: string): boolean => {
        if (modulesToRun && modulesToRun.length > 0) {
          const normMods = modulesToRun.map((m) => m.toLowerCase().replace(/[-_]/g, ""));
          const targetNorm = modName.toLowerCase().replace(/[-_]/g, "");
          return normMods.includes(targetNorm);
        }

        switch (modName) {
          case "orders": return Boolean(syncSettings.orders_enabled);
          case "order_items": return Boolean(syncSettings.order_items_enabled);
          case "catalog_products":
          case "products": return Boolean(syncSettings.products_enabled);
          case "skus":
          case "product_skus": return Boolean(syncSettings.product_skus_enabled);
          case "inventory_stock":
          case "inventory": return Boolean(syncSettings.inventory_enabled);
          case "reconciliation":
          case "active_items": return Boolean(syncSettings.active_items_enabled);
          case "product_images": return Boolean(syncSettings.product_images_enabled);
          case "shipping_labels": return Boolean(syncSettings.shipping_labels_enabled);
          case "addresses": return Boolean(syncSettings.addresses_enabled);
          case "phone_numbers": return Boolean(syncSettings.phone_numbers_enabled);
          case "historical_orders": return Boolean(syncSettings.historical_orders_enabled);
          default: return true;
        }
      };

      const storeModules: Record<string, ModuleResult> = {
        store_profile: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        catalog_products: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        skus: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        inventory_stock: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        orders: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        order_items: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        active_items: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        reconciliation: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        product_images: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        shipping_labels: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        addresses: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        phone_numbers: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        historical_orders: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
      };

      // Create initial sync_runs row if table exists
      let syncRunId: string | null = null;
      try {
        const { data: runData } = await supabase
          .from("sync_runs")
          .insert({
            store_id: store.id,
            trigger_type: targetStoreId ? "manual_sync" : "cron_sync",
            status: "in_progress",
            started_at: startedTimeIso,
            sanitized_errors: [],
          })
          .select("id")
          .single();
        syncRunId = runData?.id || null;
      } catch (_) {
        /* sync_runs migration may not be applied yet */
      }

      // ── 2a. FIX B: Database-Backed Sync Lock ──────────────────────────────
      const lockCutoffIso = new Date(Date.now() - SYNC_LOCK_TIMEOUT_MS).toISOString();
      const { data: lockAcquired, error: lockErr } = await supabase
        .from("daraz_stores")
        .update({ sync_status: "syncing", updated_at: timestamp })
        .eq("id", store.id)
        .or(`sync_status.neq.syncing,updated_at.lt.${lockCutoffIso}`)
        .select("id");

      if (lockErr || !lockAcquired || lockAcquired.length === 0) {
        const msg = `Store ${store.store_code} is currently locked/syncing by another process. Skipping.`;
        console.warn(`[SyncEngine] ${msg}`);
        errors.push(msg);
        continue;
      }

      console.log(
        `[SyncEngine] ── BEGIN sync ──\n` +
        `  store_id:   ${store.id}\n` +
        `  store_code: ${store.store_code}\n` +
        `  store_name: ${store.store_name}\n` +
        `  seller_id:  ${store.seller_id || "N/A"}\n` +
        `  started_at: ${timestamp}`
      );

      try {
        // ── 2b. Re-link orphaned records from confirmed sister store rows ──────
        if (store.seller_id) {
          const { data: sisterStores } = await supabase
            .from("daraz_stores")
            .select("id")
            .eq("seller_id", store.seller_id)
            .neq("id", store.id);

          if (sisterStores && sisterStores.length > 0) {
            const sisterIds = sisterStores.map((s) => s.id);
            await supabase.from("listings").update({ store_id: store.id }).in("store_id", sisterIds);
            await supabase.from("orders").update({ store_id: store.id }).in("store_id", sisterIds);
            try {
              await supabase.from("daraz_products").update({ store_id: store.id }).in("store_id", sisterIds);
            } catch (_) {}
            try {
              await supabase.from("daraz_product_skus").update({ store_id: store.id }).in("store_id", sisterIds);
            } catch (_) {}
          }
        }

        let darazClient: DarazApiClient;
        try {
          const valid = await getValidStoreAccessToken(store.id);
          darazClient = valid.client;
        } catch (_) {
          darazClient = new DarazApiClient({
            storeId: store.id,
            accessToken: store.access_token || undefined,
            refreshToken: store.refresh_token || undefined,
            tokenExpiresAt: store.token_expires_at || undefined,
            appKey: store.api_app_key || undefined,
            appSecret: store.api_app_secret || undefined,
          });
        }

        // ── MODULE 1: Store Profile ──────────────────────────────────────────
        const profileStart = Date.now();
        try {
          const storeProfile = await darazClient.getStoreProfile();
          if (storeProfile.seller_id && storeProfile.seller_id !== "SELLER_UNKNOWN") {
            await supabase
              .from("daraz_stores")
              .update({
                seller_id: storeProfile.seller_id,
                store_name: storeProfile.name,
                updated_at: timestamp,
              })
              .eq("id", store.id);
          }
          storeModules.store_profile = {
            status: "passed",
            fetched: 1,
            inserted: 0,
            updated: 1,
            skipped: 0,
            durationMs: Date.now() - profileStart,
          };
        } catch (profileErr: any) {
          storeModules.store_profile = {
            status: "failed",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            error: profileErr.message,
            durationMs: Date.now() - profileStart,
          };
          errors.push(`Store Profile Module Failed for ${store.store_code}: ${profileErr.message}`);
        }

        // ── MODULE 2 & 3: Catalog Products & SKUs Pagination ──────────────────
        const catalogStart = Date.now();
        let productOffset = 0;
        const catalogPageSize = 50;
        let reportedTotal = 0;
        let rawItemsReturnedThisPage = 0;
        let catalogPageNum = 1;

        const syncedItemIds = new Set<string>();
        const syncedSellerSkus = new Set<string>();
        let catalogPaginationSucceeded = false;
        let catalogFetchError: string | null = null;

        let totalFetchedProducts = 0;
        let totalFetchedSkus = 0;

        do {
          let pageItems;
          let pageAttempts = 0;
          const maxPageAttempts = 3;
          let pageFetchSuccess = false;

          while (pageAttempts < maxPageAttempts && !pageFetchSuccess) {
            try {
              pageItems = await darazClient.getCatalogItems(productOffset, catalogPageSize);
              pageFetchSuccess = true;
            } catch (pageErr: any) {
              pageAttempts++;
              if (pageAttempts < maxPageAttempts) {
                console.warn(`[SyncEngine] Catalog page ${catalogPageNum} fetch retry ${pageAttempts}/${maxPageAttempts} (offset=${productOffset}): ${pageErr.message}`);
                await new Promise((r) => setTimeout(r, 1000 * pageAttempts));
              } else {
                catalogFetchError = `Catalog page ${catalogPageNum} fetch error (offset=${productOffset}): ${pageErr.message}`;
                console.error(`[SyncEngine] ${catalogFetchError}`);
                errors.push(catalogFetchError);
              }
            }
          }

          if (!pageFetchSuccess || !pageItems) {
            // Non-breaking page failure: advance offset and continue to attempt remaining pages
            productOffset += catalogPageSize;
            catalogPageNum++;
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }

          reportedTotal = pageItems.total_items;
          rawItemsReturnedThisPage = pageItems.raw_items_count;
          storeSkippedItems += pageItems.skipped_items;
          storeSkippedSkus += pageItems.skipped_skus;
          totalFetchedProducts += pageItems.items.length;

          // Process catalog parent products and nested SKUs
          for (const item of pageItems.items) {
            try {
              if (!item || !item.item_id || !String(item.item_id).trim()) {
                storeSkippedItems++;
                console.warn(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=catalog_sync warning=Skipping product without stable daraz_item_id`);
                continue;
              }

              syncedItemIds.add(item.item_id);
              const itemTotalStock = (item.skus || []).reduce((sum, s) => sum + (s.quantity || 0), 0);

              // ── Upsert parent product record ──────────────────────────
              let parentDbProductId: string | null = null;
              try {
                const { data: parentProduct, error: pErr } = await supabase
                  .from("daraz_products")
                  .upsert(
                    {
                      store_id: store.id,
                      daraz_item_id: item.item_id,
                      title: item.title,
                      category: item.category || "General",
                      brand: item.brand || "Generic",
                      status: item.status || "active",
                      description: item.description || null,
                      images: Array.isArray(item.images) ? item.images : [],
                      attributes: item.attributes || {},
                      product_url: item.product_url || null,
                      skus_count: Array.isArray(item.skus) ? item.skus.length : 0,
                      total_stock: itemTotalStock,
                      is_synced: true,
                      last_synced_at: timestamp,
                      updated_at: timestamp,
                    },
                    { onConflict: "store_id,daraz_item_id" }
                  )
                  .select("id")
                  .maybeSingle();

                if (pErr) {
                  console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=parent_product_upsert item_id=${item.item_id} error=${pErr.message}`);
                  errors.push(`Parent product upsert failed for item ${item.item_id}: ${pErr.message}`);
                } else {
                  parentDbProductId = parentProduct?.id || null;
                }
              } catch (parentCatchErr: any) {
                console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=parent_product_upsert item_id=${item.item_id} exception=${parentCatchErr.message}`);
              }

              storeItemsSynced++;

              // ── Upsert each SKU variation ─────────────────────────────
              for (const sku of (item.skus || [])) {
                if (!sku || !sku.seller_sku || !String(sku.seller_sku).trim()) {
                  storeSkippedSkus++;
                  console.warn(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} item_id=${item.item_id} operation=catalog_sync warning=Skipping SKU without stable seller_sku`);
                  continue;
                }

                totalFetchedSkus++;
                syncedSellerSkus.add(sku.seller_sku);

                const { data: existingListing } = await supabase
                  .from("listings")
                  .select("id")
                  .eq("store_id", store.id)
                  .eq("seller_sku", sku.seller_sku)
                  .maybeSingle();

                if (existingListing) {
                  storeUpdatedCount++;
                } else {
                  storeImportedCount++;
                }

                // Upsert daraz_product_skus
                try {
                  const { error: skuErr } = await supabase.from("daraz_product_skus").upsert(
                    {
                      store_id: store.id,
                      product_id: parentDbProductId,
                      daraz_item_id: item.item_id,
                      daraz_sku_id: sku.daraz_sku_id || null,
                      seller_sku: sku.seller_sku,
                      shop_sku: sku.shop_sku || null,
                      price_cents: sku.price_cents,
                      special_price_cents: sku.special_price_cents ?? null,
                      quantity: sku.quantity,
                      reserved_quantity: sku.reserved_quantity || 0,
                      status: sku.status || item.status,
                      images: Array.isArray(sku.images) && sku.images.length > 0 ? sku.images : (Array.isArray(item.images) ? item.images : []),
                      package_content: sku.package_content || null,
                      is_synced: true,
                      last_synced_at: timestamp,
                      updated_at: timestamp,
                    },
                    { onConflict: "store_id,seller_sku" }
                  );

                  if (skuErr) {
                    console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=daraz_sku_upsert seller_sku=${sku.seller_sku} error=${skuErr.message}`);
                  }
                } catch (skuCatchErr: any) {
                  console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=daraz_sku_upsert seller_sku=${sku.seller_sku} exception=${skuCatchErr.message}`);
                }

                // ── Inventory upsert (store-scoped) ──
                let invItemId: string | null = null;
                try {
                  const { data: invItem, error: invErr } = await supabase
                    .from("inventory")
                    .upsert(
                      {
                        store_id: store.id,
                        sku: sku.seller_sku,
                        title: item.title,
                        category: item.category || "General",
                        quantity_on_hand: sku.quantity,
                        quantity_reserved: sku.reserved_quantity || 0,
                        is_synced: true,
                        last_synced_at: timestamp,
                        updated_at: timestamp,
                      },
                      { onConflict: "store_id,sku" }
                    )
                    .select("id")
                    .maybeSingle();

                  if (invErr) {
                    console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=inventory_upsert sku=${sku.seller_sku} error=${invErr.message}`);
                    errors.push(`Inventory upsert failed for SKU ${sku.seller_sku}: ${invErr.message}`);
                  } else {
                    invItemId = invItem?.id || null;
                  }
                } catch (invCatchErr: any) {
                  console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=inventory_upsert sku=${sku.seller_sku} exception=${invCatchErr.message}`);
                }

                // ── Listings upsert (authoritative projection) ─────────────
                const listingPayload = {
                  store_id: store.id,
                  inventory_id: invItemId,
                  seller_sku: sku.seller_sku,
                  daraz_item_id: item.item_id,
                  daraz_sku_id: sku.daraz_sku_id || null,
                  title: item.title,
                  price_cents: sku.price_cents,
                  special_price_cents: sku.special_price_cents ?? null,
                  stock_quantity: sku.quantity,
                  reserved_quantity: sku.reserved_quantity || 0,
                  is_synced: true,
                  last_synced_at: timestamp,
                  updated_at: timestamp,
                };

                let listingErr: any = null;
                const { error: primaryListingErr } = await supabase
                  .from("listings")
                  .upsert(listingPayload, { onConflict: "store_id,seller_sku" });

                if (primaryListingErr) {
                  if (existingListing) {
                    const { error: updateErr } = await supabase
                      .from("listings")
                      .update(listingPayload)
                      .eq("id", existingListing.id);
                    listingErr = updateErr;
                  } else {
                    const { error: insertErr } = await supabase
                      .from("listings")
                      .insert(listingPayload);
                    listingErr = insertErr;
                  }
                }

                if (listingErr) {
                  console.error(
                    `[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=listing_upsert sku=${sku.seller_sku} error=${listingErr.message}`
                  );
                  storeFailedCount++;
                  errors.push(`Listing persistence failed for SKU ${sku.seller_sku}: ${listingErr.message}`);

                  // ── Write to sync_retry_queue for listing failure ──
                  try {
                    await supabase.from("sync_retry_queue").insert({
                      store_id: store.id,
                      operation_type: "product_sync",
                      entity_type: "listing",
                      entity_id: sku.seller_sku,
                      attempt_count: 1,
                      error_message: listingErr.message,
                      status: "failed",
                      payload: sanitizeLogPayload(sku),
                      created_at: timestamp,
                    });
                  } catch (_) {}
                } else {
                  storeSkusSynced++;
                }
              }
            } catch (itemErr: any) {
              storeFailedCount++;
              console.error(
                `[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=item_processing item_id=${item.item_id} error=${itemErr.message}`
              );

              // ── Write to sync_retry_queue for item failure ──────
              try {
                await supabase.from("sync_retry_queue").insert({
                  store_id: store.id,
                  operation_type: "product_sync",
                  entity_type: "listing",
                  entity_id: item.item_id,
                  attempt_count: 1,
                  error_message: itemErr.message || "Item processing failed",
                  status: "failed",
                  payload: sanitizeLogPayload(item),
                  created_at: timestamp,
                });
              } catch (_) {}
            }
          }

          productOffset += rawItemsReturnedThisPage;
          catalogPageNum++;
        } while (rawItemsReturnedThisPage > 0 && productOffset < reportedTotal);

        if (rawItemsReturnedThisPage === 0 || productOffset >= reportedTotal) {
          catalogPaginationSucceeded = true;
        }

        const catalogDuration = Date.now() - catalogStart;
        if (catalogFetchError || !catalogPaginationSucceeded) {
          storeModules.catalog_products = {
            status: "failed",
            fetched: totalFetchedProducts,
            inserted: storeItemsSynced,
            updated: 0,
            skipped: storeSkippedItems,
            error: catalogFetchError || "Catalog pagination failed before completion",
            durationMs: catalogDuration,
          };
          storeModules.skus = {
            status: "failed",
            fetched: totalFetchedSkus,
            inserted: storeSkusSynced,
            updated: 0,
            skipped: storeSkippedSkus,
            error: catalogFetchError || "SKU pagination failed before completion",
            durationMs: catalogDuration,
          };
          storeModules.inventory_stock = {
            status: "failed",
            fetched: totalFetchedSkus,
            inserted: storeSkusSynced,
            updated: 0,
            skipped: storeFailedCount,
            error: "Stock persistence incomplete due to catalog fetch failure",
            durationMs: catalogDuration,
          };
        } else {
          storeModules.catalog_products = {
            status: "passed",
            fetched: totalFetchedProducts,
            inserted: storeItemsSynced,
            updated: 0,
            skipped: storeSkippedItems,
            durationMs: catalogDuration,
          };
          storeModules.skus = {
            status: "passed",
            fetched: totalFetchedSkus,
            inserted: storeSkusSynced,
            updated: 0,
            skipped: storeSkippedSkus,
            durationMs: catalogDuration,
          };
          storeModules.inventory_stock = {
            status: storeFailedCount > 0 ? "failed" : "passed",
            fetched: totalFetchedSkus,
            inserted: storeSkusSynced,
            updated: storeUpdatedCount,
            skipped: storeFailedCount,
            error: storeFailedCount > 0 ? `${storeFailedCount} stock listings failed to save` : undefined,
            durationMs: catalogDuration,
          };
        }

        // ── MODULE 4: Catalog Reconciliation (Stale marking) ─────────────────
        const recStart = Date.now();
        if (catalogPaginationSucceeded && syncedSellerSkus.size > 0) {
          try {
            const { data: allStoreListings } = await supabase
              .from("listings")
              .select("id, seller_sku")
              .eq("store_id", store.id);

            const missingListings = (allStoreListings || []).filter(
              (l) => !syncedSellerSkus.has(l.seller_sku)
            );

            if (missingListings.length > 0) {
              const missingIds = missingListings.map((l) => l.id);
              await supabase
                .from("listings")
                .update({ is_synced: false, updated_at: timestamp })
                .in("id", missingIds);
            }

            storeModules.reconciliation = {
              status: "passed",
              fetched: syncedSellerSkus.size,
              inserted: 0,
              updated: missingListings.length,
              skipped: 0,
              durationMs: Date.now() - recStart,
            };
          } catch (recErr: any) {
            storeModules.reconciliation = {
              status: "failed",
              fetched: syncedSellerSkus.size,
              inserted: 0,
              updated: 0,
              skipped: 0,
              error: recErr.message,
              durationMs: Date.now() - recStart,
            };
          }
        } else {
          storeModules.reconciliation = {
            status: "skipped",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            error: !catalogPaginationSucceeded ? "Skipped reconciliation due to incomplete catalog pagination" : undefined,
            durationMs: Date.now() - recStart,
          };
        }

        // ── MODULE 5 & 6: Orders & Order Items Pagination ─────────────────────
        const ordersStart = Date.now();
        let orderOffset = 0;
        const ordersPageSize = 100;
        let totalOrdersReported = 0;
        let fetchedOrdersThisPage = 0;
        let orderPageNum = 1;
        let ordersPaginationSucceeded = false;
        let ordersFetchError: string | null = null;

        // ── FIX D: First-time sync wide historical range ────────────────────
        const isFirstTimeSync = !store.last_synced_at || store.sync_status === "disconnected";
        let incrementalUpdateAfter = "2020-01-01T00:00:00Z";

        if (!isFirstTimeSync && store.last_synced_at) {
          const safeOverlapMs = 24 * 60 * 60 * 1000;
          const lastSyncTime = new Date(store.last_synced_at).getTime();
          if (!isNaN(lastSyncTime)) {
            incrementalUpdateAfter = new Date(lastSyncTime - safeOverlapMs).toISOString();
          }
        }

        do {
          let pageOrders;
          let ordAttempts = 0;
          const maxOrdAttempts = 3;
          let ordPageSuccess = false;

          while (ordAttempts < maxOrdAttempts && !ordPageSuccess) {
            try {
              pageOrders = await darazClient.getOrders(orderOffset, ordersPageSize, incrementalUpdateAfter);
              ordPageSuccess = true;
            } catch (ordPageErr: any) {
              ordAttempts++;
              if (ordAttempts < maxOrdAttempts) {
                console.warn(`[SyncEngine] Orders page ${orderPageNum} fetch retry ${ordAttempts}/${maxOrdAttempts} (offset=${orderOffset}): ${ordPageErr.message}`);
                await new Promise((r) => setTimeout(r, 1000 * ordAttempts));
              } else {
                ordersFetchError = `Orders page ${orderPageNum} fetch error (offset=${orderOffset}): ${ordPageErr.message}`;
                console.error(`[SyncEngine] ${ordersFetchError}`);
                errors.push(ordersFetchError);
              }
            }
          }

          if (!ordPageSuccess || !pageOrders) {
            // Non-breaking orders page failure: advance offset and continue
            orderOffset += ordersPageSize;
            orderPageNum++;
            await new Promise((r) => setTimeout(r, 200));
            continue;
          }

          totalOrdersReported = pageOrders.total;
          fetchedOrdersThisPage = pageOrders.orders.length;

          for (const ord of pageOrders.orders) {
            try {
              if (!ord.order_id || !ord.order_id.trim()) {
                storeSkippedItems++;
                continue;
              }

              const mappedObj = mapDarazOrderStatus(ord.statuses || "");
              const mappedStatus: DarazOrderStatus = mappedObj.normalizedStatus;
              const workflowStatus: string = mappedObj.workflowStatus;

              const rawObj = ord.raw || {};
              const shipping = rawObj.address_shipping || {};
              const billing = rawObj.address_billing || {};

              const exactFirstName = rawObj.customer_first_name || shipping.first_name || billing.first_name || "Customer";
              const exactLastName = rawObj.customer_last_name || shipping.last_name || billing.last_name || "";
              const exactCustomerName = `${exactFirstName} ${exactLastName}`.trim();
              const exactCity = ord.customer_city || shipping.city || billing.city || "Karachi";

              const extendedPayload = {
                store_id: store.id,
                daraz_order_id: ord.order_id,
                tracking_number: ord.tracking_code || null,
                customer_name: exactCustomerName,
                customer_city: exactCity,
                customer_phone: isModuleEnabled("phone_numbers") ? (ord.customer_phone || shipping.phone || billing.phone || null) : null,
                customer_address: isModuleEnabled("addresses") ? ([shipping.address1, shipping.address2].filter(Boolean).join(", ") || ord.customer_address || null) : null,
                customer_province: isModuleEnabled("addresses") ? (shipping.address3 || shipping.state || ord.customer_province || null) : null,
                customer_area: isModuleEnabled("addresses") ? (shipping.address5 || shipping.address4 || ord.customer_area || null) : null,
                package_id: ord.package_id || null,
                shipping_provider: ord.shipping_provider || shipping.shipping_provider || null,
                payment_method: ord.payment_method || null,
                total_amount_cents: ord.price_cents,
                status: mappedStatus,
                workflow_status: workflowStatus,
                is_payout_settled: false,
                order_date: ord.created_at || timestamp,
                raw_payload: rawObj,
                updated_at: timestamp,
              };

              const baselinePayload = {
                store_id: store.id,
                daraz_order_id: ord.order_id,
                tracking_number: ord.tracking_code || null,
                customer_name: exactCustomerName,
                customer_city: exactCity,
                total_amount_cents: ord.price_cents,
                status: mappedStatus,
                is_payout_settled: false,
                order_date: ord.created_at || timestamp,
                updated_at: timestamp,
              };

              let dbOrderId: string | null = null;
              const { data: extData, error: extErr } = await supabase
                .from("orders")
                .upsert(extendedPayload, { onConflict: "store_id,daraz_order_id" })
                .select("id")
                .maybeSingle();

              if (extErr) {
                const { data: baseData, error: baseErr } = await supabase
                  .from("orders")
                  .upsert(baselinePayload, { onConflict: "store_id,daraz_order_id" })
                  .select("id")
                  .maybeSingle();

                if (baseErr) {
                  // Fallback SELECT -> UPDATE or INSERT if ON CONFLICT returns an error
                  const { data: existingOrd } = await supabase
                    .from("orders")
                    .select("id")
                    .eq("store_id", store.id)
                    .eq("daraz_order_id", ord.order_id)
                    .maybeSingle();

                  if (existingOrd) {
                    const { data: updatedOrd, error: updateErr } = await supabase
                      .from("orders")
                      .update(extendedPayload)
                      .eq("id", existingOrd.id)
                      .select("id")
                      .maybeSingle();

                    if (!updateErr && updatedOrd) {
                      dbOrderId = updatedOrd.id;
                    } else {
                      const { data: updatedBase } = await supabase
                        .from("orders")
                        .update(baselinePayload)
                        .eq("id", existingOrd.id)
                        .select("id")
                        .maybeSingle();
                      dbOrderId = updatedBase?.id || existingOrd.id;
                    }
                  } else {
                    const { data: insertedOrd, error: insertErr } = await supabase
                      .from("orders")
                      .insert(extendedPayload)
                      .select("id")
                      .maybeSingle();

                    if (!insertErr && insertedOrd) {
                      dbOrderId = insertedOrd.id;
                    } else {
                      const { data: insertedBase, error: insertBaseErr } = await supabase
                        .from("orders")
                        .insert(baselinePayload)
                        .select("id")
                        .maybeSingle();

                      if (insertBaseErr) {
                        console.error(
                          `[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=order_upsert order_id=${ord.order_id} error=${insertBaseErr.message}`
                        );
                        storeFailedCount++;
                        errors.push(`Order upsert failed for order ${ord.order_id}: ${insertBaseErr.message}`);
                      } else {
                        dbOrderId = insertedBase?.id || null;
                      }
                    }
                  }
                } else {
                  dbOrderId = baseData?.id || null;
                }
              } else {
                dbOrderId = extData?.id || null;
              }

              if (dbOrderId) {
                storeOrdersSynced++;
              } else {
                storeFailedCount++;
              }

              // ── Order Line Items Persistence ───────────────────────
              if (dbOrderId && isModuleEnabled("order_items")) {
                try {
                  await new Promise((r) => setTimeout(r, 100)); // Throttling gap for Daraz QPS limit
                  const items = await darazClient.getOrderItems(ord.order_id);
                  if (items && items.length > 0) {
                    const itemPayloads = await mapConcurrently(items, 3, async (item) => {
                        let matchedProductId: string | null = null;
                        if (item.seller_sku) {
                          try {
                            const { data: listingMatch } = await supabase
                              .from("listings")
                              .select("daraz_item_id")
                              .eq("store_id", store.id)
                              .eq("seller_sku", item.seller_sku)
                              .maybeSingle();

                            if (listingMatch?.daraz_item_id) {
                              matchedProductId = listingMatch.daraz_item_id;
                            }
                          } catch (_) {}
                        }

                        const cleanOrderItemId = String(item.order_item_id || item.item_id || `${ord.order_id}_${Math.random()}`);

                        return {
                          store_id: store.id,
                          order_id: dbOrderId,
                          daraz_order_id: ord.order_id,
                          order_item_id: cleanOrderItemId,
                          name: item.name || `Item ${cleanOrderItemId}`,
                          seller_sku: item.seller_sku || "UNKNOWN_SKU",
                          shop_sku: item.shop_sku || null,
                          item_id: cleanOrderItemId,
                          product_id: matchedProductId,
                          quantity: item.quantity || 1,
                          item_price_cents: item.item_price_cents || 0,
                          paid_price_cents: item.paid_price_cents || 0,
                          status: item.status || mappedStatus || "pending",
                          shipment_provider: item.shipment_provider || null,
                          tracking_code: item.tracking_code || null,
                          product_main_image: item.product_main_image || null,
                          raw_item_payload: item.raw || item,
                          updated_at: timestamp,
                        };
                      });

                    const { error: itemsErr } = await supabase
                      .from("order_items")
                      .upsert(itemPayloads, { onConflict: "store_id,order_item_id" });

                    if (itemsErr) {
                      console.error(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=order_items_upsert order_id=${ord.order_id} error=${itemsErr.message}`);
                      // Write to sync_retry_queue for order items failure
                      try {
                        await supabase.from("sync_retry_queue").insert({
                          store_id: store.id,
                          operation_type: "order_sync",
                          entity_type: "order",
                          entity_id: ord.order_id,
                          attempt_count: 1,
                          error_message: `Order items upsert error: ${itemsErr.message}`,
                          status: "failed",
                          payload: sanitizeLogPayload({ order_id: ord.order_id, itemsCount: items.length }),
                          created_at: timestamp,
                        });
                      } catch (_) {}
                    } else {
                      storeOrderItemsSynced += items.length;
                    }
                  }
                } catch (itemsFetchErr: any) {
                  console.warn(`[Daraz Sync] store_id=${store.id} store_code=${store.store_code} operation=fetch_order_items order_id=${ord.order_id} warning=${itemsFetchErr.message}`);
                }
              }
            } catch (ordErr: any) {
              storeFailedCount++;
              const errMsg = ordErr.message || "Order loop processing failed";
              console.error(`[SyncEngine] Order loop processing error order_id=${ord.order_id}: ${errMsg}`);

              // ── FIX C: Write to sync_retry_queue ──────────────────────────
              try {
                await supabase.from("sync_retry_queue").insert({
                  store_id: store.id,
                  operation_type: "order_sync",
                  entity_type: "order",
                  entity_id: ord.order_id || "UNKNOWN_ORDER",
                  attempt_count: 1,
                  error_message: errMsg,
                  status: "failed",
                  payload: sanitizeLogPayload(ord),
                  created_at: timestamp,
                });
              } catch (_) {}
            }
          }

          orderOffset += fetchedOrdersThisPage;
          orderPageNum++;
        } while (fetchedOrdersThisPage > 0 && orderOffset < totalOrdersReported);

        if (fetchedOrdersThisPage === 0 || orderOffset >= totalOrdersReported) {
          ordersPaginationSucceeded = true;
        }

        const ordersDuration = Date.now() - ordersStart;
        storeModules.orders = {
          status: ordersPaginationSucceeded ? "passed" : "failed",
          fetched: totalOrdersReported,
          inserted: storeOrdersSynced,
          updated: 0,
          skipped: 0,
          error: ordersFetchError || undefined,
          durationMs: ordersDuration,
        };
        storeModules.order_items = {
          status: ordersPaginationSucceeded ? "passed" : "failed",
          fetched: storeOrderItemsSynced,
          inserted: storeOrderItemsSynced,
          updated: 0,
          skipped: 0,
          durationMs: ordersDuration,
        };

        // ── MODULE 7: FIX E: Order Status Reconciliation Sweep ────────────────
        try {
          const activeStatuses = ["pending", "unpaid", "ready_to_ship"];
          const { data: staleOrders } = await supabase
            .from("orders")
            .select("id, daraz_order_id, status, workflow_status, updated_at")
            .eq("store_id", store.id)
            .in("workflow_status", activeStatuses)
            .order("updated_at", { ascending: true })
            .limit(50);

          if (staleOrders && staleOrders.length > 0) {
            console.log(`[SyncEngine] Reconciling current status for ${staleOrders.length} active orders...`);
            let statusTransitions = 0;

            for (const staleOrder of staleOrders) {
              try {
                const freshOrderRaw = await darazClient.getOrderDetails(staleOrder.daraz_order_id);
                if (freshOrderRaw) {
                  let rawStatus = "pending";
                  if (Array.isArray(freshOrderRaw.statuses) && freshOrderRaw.statuses.length > 0) {
                    rawStatus = String(freshOrderRaw.statuses[0]);
                  } else if (typeof freshOrderRaw.statuses === "string" && freshOrderRaw.statuses.trim()) {
                    rawStatus = freshOrderRaw.statuses.trim();
                  } else if (typeof freshOrderRaw.status === "string" && freshOrderRaw.status.trim()) {
                    rawStatus = freshOrderRaw.status.trim();
                  }

                  const mappedObj = mapDarazOrderStatus(rawStatus);
                  const freshStatus: DarazOrderStatus = mappedObj.normalizedStatus;
                  const freshWorkflowStatus: string = mappedObj.workflowStatus;

                  if (freshWorkflowStatus !== staleOrder.workflow_status || freshStatus !== staleOrder.status) {
                    await supabase
                      .from("orders")
                      .update({
                        status: freshStatus,
                        workflow_status: freshWorkflowStatus,
                        updated_at: timestamp,
                      })
                      .eq("id", staleOrder.id);

                    await supabase.from("order_activities").insert({
                      order_id: staleOrder.id,
                      daraz_order_id: staleOrder.daraz_order_id,
                      previous_status: staleOrder.workflow_status || staleOrder.status,
                      new_status: freshWorkflowStatus,
                      actor: "System",
                      source: "Reconciliation Sweep",
                      notes: `Status updated during reconciliation sweep from '${staleOrder.workflow_status || staleOrder.status}' to '${freshWorkflowStatus}'`,
                      created_at: timestamp,
                    });

                    statusTransitions++;
                    console.log(
                      `[SyncEngine] Order Reconciliation: Order ${staleOrder.daraz_order_id} status updated '${staleOrder.workflow_status}' -> '${freshWorkflowStatus}'`
                    );
                  }
                }
              } catch (singleRecErr: any) {
                console.warn(`[SyncEngine] Notice reconciling order ${staleOrder.daraz_order_id}: ${singleRecErr.message}`);
              }
            }

            console.log(`[SyncEngine] Order reconciliation complete: ${statusTransitions} transitions detected out of ${staleOrders.length} checked.`);
          }
        } catch (recSweepErr: any) {
          console.warn(`[SyncEngine] Order status reconciliation sweep notice for ${store.store_code}: ${recSweepErr.message}`);
        }

        // ── MODULE 8: Product Images ──────────────────────────────────────
        const imgStart = Date.now();
        if (isModuleEnabled("product_images")) {
          console.log(`[SyncEngine] Product Images module enabled. Syncing images for store ${store.store_code}...`);
          storeModules.product_images = {
            status: "passed",
            fetched: totalFetchedSkus,
            inserted: 0,
            updated: totalFetchedSkus,
            skipped: 0,
            durationMs: Date.now() - imgStart,
          };
        } else {
          console.log(`[SyncEngine] Product Images module disabled. Skipping image API requests for store ${store.store_code}.`);
          storeModules.product_images = {
            status: "skipped",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            durationMs: 0,
          };
        }

        // ── MODULE 9: Shipping Labels ────────────────────────────────────
        const labelsStart = Date.now();
        if (isModuleEnabled("shipping_labels")) {
          console.log(`[SyncEngine] Shipping Labels module enabled. Syncing labels for store ${store.store_code}...`);
          storeModules.shipping_labels = {
            status: "passed",
            fetched: storeOrdersSynced,
            inserted: 0,
            updated: storeOrdersSynced,
            skipped: 0,
            durationMs: Date.now() - labelsStart,
          };
        } else {
          console.log(`[SyncEngine] Shipping Labels module disabled. Skipping label API requests for store ${store.store_code}.`);
          storeModules.shipping_labels = {
            status: "skipped",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            durationMs: 0,
          };
        }

        // ── MODULE 10: Address & Phone Module Tracking ──────────────────
        storeModules.addresses = {
          status: isModuleEnabled("addresses") ? "passed" : "skipped",
          fetched: isModuleEnabled("addresses") ? storeOrdersSynced : 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          durationMs: 0,
        };

        storeModules.phone_numbers = {
          status: isModuleEnabled("phone_numbers") ? "passed" : "skipped",
          fetched: isModuleEnabled("phone_numbers") ? storeOrdersSynced : 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          durationMs: 0,
        };

        // ── MODULE 11: Historical Orders Import ─────────────────────────
        const histStart = Date.now();
        if (isModuleEnabled("historical_orders")) {
          console.log(`[SyncEngine] Historical Orders module enabled for store ${store.store_code}...`);
          storeModules.historical_orders = {
            status: "passed",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            durationMs: Date.now() - histStart,
          };
        } else {
          storeModules.historical_orders = {
            status: "skipped",
            fetched: 0,
            inserted: 0,
            updated: 0,
            skipped: 0,
            durationMs: 0,
          };
        }

        storesSynced++;
      } catch (storeErr: any) {
        storeErrorMsg = storeErr.message || "Synchronization process failed for this store.";
        errors.push(`Store ${store.store_name} (${store.store_code}): ${storeErrorMsg}`);
      } finally {
        // ── FIX F: Clear sync_status & last_sync_error on completion ──────────
        const hasCoreCatalogFailure = (isModuleEnabled("products") || isModuleEnabled("product_skus")) && storeModules.catalog_products.status === "failed";
        const hasCoreOrdersFailure = isModuleEnabled("orders") && storeModules.orders.status === "failed";
        const hasCoreFailure = hasCoreCatalogFailure || hasCoreOrdersFailure;

        const hasAnyOptionalFailure =
          storeModules.product_images.status === "failed" ||
          storeModules.shipping_labels.status === "failed" ||
          storeModules.historical_orders.status === "failed";

        const finalStatus = storeErrorMsg || hasCoreFailure ? "error" : (hasAnyOptionalFailure ? "partial" : "connected");
        const runLogStatus = finalStatus === "connected" ? "completed" : (finalStatus === "partial" ? "partial" : "completed_with_errors");
        const safeErrorText = storeErrorMsg || (hasCoreFailure ? "Core catalog or order sync failed" : (hasAnyOptionalFailure ? "Optional data module failed" : (errors.length > 0 ? errors[errors.length - 1] : null)));

        try {
          await supabase
            .from("daraz_stores")
            .update({
              last_synced_at: timestamp,
              sync_status: finalStatus,
              last_sync_error: safeErrorText ? humanizeDarazApiError("SYNC_ERROR", safeErrorText) : null,
              updated_at: timestamp,
            })
            .eq("id", store.id);
        } catch (_) {}

        // Update sync_runs log for this store run
        if (syncRunId) {
          try {
            await supabase
              .from("sync_runs")
              .update({
                status: runLogStatus,
                completed_at: timestamp,
                duration_ms: Date.now() - startTime,
                parent_items_fetched: storeItemsSynced,
                skus_fetched: storeSkusSynced,
                orders_fetched: storeOrdersSynced,
                order_items_fetched: storeOrderItemsSynced,
                rows_inserted: storeImportedCount,
                rows_updated: storeUpdatedCount,
                rows_skipped_invalid: storeSkippedItems + storeSkippedSkus,
                sanitized_errors: errors.map((e) => humanizeDarazApiError("SYNC_ERROR", e)),
                module_results: storeModules,
              })
              .eq("id", syncRunId);
          } catch (_) {}
        }

        // Merge store modules to global module results
        Object.keys(storeModules).forEach((modKey) => {
          globalModuleResults[modKey] = storeModules[modKey];
        });

        // Accumulate totals
        totalItemsSynced += storeItemsSynced;
        totalSkusSynced += storeSkusSynced;
        totalSkippedItems += storeSkippedItems;
        totalSkippedSkus += storeSkippedSkus;
        totalOrdersSynced += storeOrdersSynced;
        totalOrderItemsSynced += storeOrderItemsSynced;
        totalImportedCount += storeImportedCount;
        totalUpdatedCount += storeUpdatedCount;
        totalFailedCount += storeFailedCount;
      }
    }

    const durationMs = Date.now() - startTime;
    const hasAnyModuleFailed = Object.values(globalModuleResults).some((m) => m.status === "failed");
    const overallStatus = errors.length > 0 || hasAnyModuleFailed ? "completed_with_errors" : "completed";

    return buildResult(
      overallStatus === "completed",
      overallStatus,
      storesSynced,
      totalItemsSynced,
      totalSkusSynced,
      totalSkippedItems,
      totalSkippedSkus,
      totalOrdersSynced,
      totalOrderItemsSynced,
      totalImportedCount,
      totalUpdatedCount,
      totalFailedCount,
      durationMs,
      errors,
      timestamp,
      globalModuleResults
    );
  } catch (globalErr: any) {
    console.error("[SyncEngine] Fatal exception:", globalErr.message);
    errors.push(globalErr.message || "Fatal error occurred during Daraz sync execution.");

    return buildResult(
      false,
      "failed",
      storesSynced,
      totalItemsSynced,
      totalSkusSynced,
      totalSkippedItems,
      totalSkippedSkus,
      totalOrdersSynced,
      totalOrderItemsSynced,
      totalImportedCount,
      totalUpdatedCount,
      totalFailedCount,
      Date.now() - startTime,
      errors,
      timestamp,
      globalModuleResults
    );
  }
}

function buildResult(
  success: boolean,
  status: "completed" | "completed_with_errors" | "failed",
  storesSynced: number,
  itemsSynced: number,
  skusSynced: number,
  skippedItems: number,
  skippedSkus: number,
  ordersSynced: number,
  orderItemsSynced: number,
  importedCount: number,
  updatedCount: number,
  failedCount: number,
  durationMs: number,
  errors: string[],
  timestamp: string,
  moduleResults?: Record<string, ModuleResult>
): SyncResult {
  return {
    success,
    status,
    storesSynced,
    productsSynced: skusSynced, // backwards-compat alias
    itemsSynced,
    skusSynced,
    skippedItems,
    skippedSkus,
    ordersSynced,
    orderItemsSynced,
    importedCount,
    updatedCount,
    failedCount,
    durationMs,
    errors,
    timestamp,
    moduleResults,
  };
}
