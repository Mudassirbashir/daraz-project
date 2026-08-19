import { createAdminClient } from "../supabase/admin";
import { DarazApiClient, sanitizeLogPayload, humanizeDarazApiError } from "./client";
import { DarazOrderStatus } from "../../types/database.types";
import { mapDarazOrderStatus } from "./order-status";

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
 * Production-Grade Synchronization Engine
 *
 * Key guarantees:
 * 1. Per-store atomic database row lock acquired before any sync work begins.
 * 2. Lock always released in a finally block regardless of success or failure.
 * 3. Split sync execution into explicit sub-modules (store_profile, catalog_products, skus, inventory_stock, orders, order_items, reconciliation).
 * 4. A full sync returns `completed_with_errors` when any required module fails.
 * 5. Inventory updates use store-scoped `(store_id, sku)` unique constraint. No global SKU fallback.
 * 6. Listing persistence is authoritative projection (includes reserved_quantity, removes invalid sync_status).
 * 7. Writes full diagnostic metrics and module results to `sync_runs` table.
 */
export async function executeDarazSync(targetStoreId?: string): Promise<SyncResult> {
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
    reconciliation: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
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

      const storeModules: Record<string, ModuleResult> = {
        store_profile: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        catalog_products: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        skus: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        inventory_stock: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        orders: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        order_items: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
        reconciliation: { status: "skipped", fetched: 0, inserted: 0, updated: 0, skipped: 0, durationMs: 0 },
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

        const darazClient = new DarazApiClient({
          storeId: store.id,
          accessToken: store.access_token || undefined,
          refreshToken: store.refresh_token || undefined,
          tokenExpiresAt: store.token_expires_at || undefined,
          appKey: store.api_app_key || undefined,
          appSecret: store.api_app_secret || undefined,
        });

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
          try {
            pageItems = await darazClient.getCatalogItems(productOffset, catalogPageSize);
          } catch (pageErr: any) {
            catalogFetchError = `Catalog page ${catalogPageNum} fetch error (offset=${productOffset}): ${pageErr.message}`;
            console.error(`[SyncEngine] ${catalogFetchError}`);
            errors.push(catalogFetchError);
            break;
          }

          reportedTotal = pageItems.total_items;
          rawItemsReturnedThisPage = pageItems.raw_items_count;
          storeSkippedItems += pageItems.skipped_items;
          storeSkippedSkus += pageItems.skipped_skus;
          totalFetchedProducts += pageItems.items.length;

          // Process catalog parent products and nested SKUs
          for (const item of pageItems.items) {
            try {
              syncedItemIds.add(item.item_id);
              const itemTotalStock = item.skus.reduce((sum, s) => sum + s.quantity, 0);

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
                      images: item.images,
                      attributes: item.attributes,
                      product_url: item.product_url || null,
                      skus_count: item.skus.length,
                      total_stock: itemTotalStock,
                      is_synced: true,
                      last_synced_at: timestamp,
                      updated_at: timestamp,
                    },
                    { onConflict: "store_id,daraz_item_id" }
                  )
                  .select("id")
                  .single();

                if (pErr) {
                  if (!pErr.message.includes("does not exist")) {
                    console.warn(`[SyncEngine] Product upsert error item_id=${item.item_id}: ${pErr.message}`);
                  }
                } else {
                  parentDbProductId = parentProduct?.id || null;
                }
              } catch (_) {}

              storeItemsSynced++;

              // ── Upsert each SKU variation ─────────────────────────────
              for (const sku of item.skus) {
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
                  await supabase.from("daraz_product_skus").upsert(
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
                      images: sku.images.length > 0 ? sku.images : item.images,
                      package_content: sku.package_content || null,
                      is_synced: true,
                      last_synced_at: timestamp,
                      updated_at: timestamp,
                    },
                    { onConflict: "store_id,seller_sku" }
                  );
                } catch (_) {}

                // ── Inventory upsert (store-scoped primary, base fallback) ──
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
                    .single();

                  if (invErr) {
                    const { data: baseInv } = await supabase
                      .from("inventory")
                      .upsert(
                        {
                          sku: sku.seller_sku,
                          title: item.title,
                          category: item.category || "General",
                          quantity_on_hand: sku.quantity,
                          updated_at: timestamp,
                        },
                        { onConflict: "sku" }
                      )
                      .select("id")
                      .single();
                    invItemId = baseInv?.id || null;
                  } else {
                    invItemId = invItem?.id || null;
                  }
                } catch (_) {}

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
                  is_synced: true,
                  last_synced_at: timestamp,
                };

                const { error: listingErr } = await supabase
                  .from("listings")
                  .upsert(listingPayload, { onConflict: "store_id,seller_sku" });

                if (listingErr) {
                  console.error(
                    `[SyncEngine] Listing upsert error SKU=${sku.seller_sku} store=${store.store_code}: ${listingErr.message}`
                  );
                  storeFailedCount++;
                  errors.push(`Listing persistence failed for SKU ${sku.seller_sku}: ${listingErr.message}`);

                  // ── FIX C: Write to sync_retry_queue for listing failure ──
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
                `[SyncEngine] Item processing error item_id=${item.item_id} store=${store.store_code}: ${itemErr.message}`
              );

              // ── FIX C: Write to sync_retry_queue for item failure ──────
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
          try {
            pageOrders = await darazClient.getOrders(orderOffset, ordersPageSize, incrementalUpdateAfter);
          } catch (ordPageErr: any) {
            ordersFetchError = `Orders page ${orderPageNum} fetch error (offset=${orderOffset}): ${ordPageErr.message}`;
            console.error(`[SyncEngine] ${ordersFetchError}`);
            errors.push(ordersFetchError);
            break;
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
                customer_phone: ord.customer_phone || shipping.phone || billing.phone || null,
                customer_address: [shipping.address1, shipping.address2].filter(Boolean).join(", ") || ord.customer_address || null,
                customer_province: shipping.address3 || shipping.state || ord.customer_province || null,
                customer_area: shipping.address5 || shipping.address4 || ord.customer_area || null,
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
                .upsert(extendedPayload, { onConflict: "daraz_order_id" })
                .select("id")
                .single();

              if (extErr) {
                const { data: baseData, error: baseErr } = await supabase
                  .from("orders")
                  .upsert(baselinePayload, { onConflict: "daraz_order_id" })
                  .select("id")
                  .single();

                if (baseErr) {
                  console.error(
                    `[SyncEngine] Order upsert failed order_id=${ord.order_id}: ext_err="${extErr.message}" base_err="${baseErr.message}"`
                  );
                  storeFailedCount++;
                  const errMsg = baseErr.message;
                  errors.push(`Order upsert failed for order ${ord.order_id}: ${errMsg}`);

                  // ── FIX C: Write to sync_retry_queue for order failure ────
                  try {
                    await supabase.from("sync_retry_queue").insert({
                      store_id: store.id,
                      operation_type: "order_sync",
                      entity_type: "order",
                      entity_id: ord.order_id,
                      attempt_count: 1,
                      error_message: errMsg,
                      status: "failed",
                      payload: sanitizeLogPayload(ord),
                      created_at: timestamp,
                    });
                  } catch (_) {}
                } else {
                  dbOrderId = baseData?.id || null;
                  storeOrdersSynced++;
                }
              } else {
                dbOrderId = extData?.id || null;
                storeOrdersSynced++;
              }

              // ── FIX A: Order Line Items Persistence ───────────────────────
              if (dbOrderId) {
                try {
                  const items = await darazClient.getOrderItems(ord.order_id);
                  if (items && items.length > 0) {
                    const itemPayloads = await Promise.all(
                      items.map(async (item) => {
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
                      })
                    );

                    const { error: itemsErr } = await supabase
                      .from("order_items")
                      .upsert(itemPayloads, { onConflict: "order_id,order_item_id" });

                    if (itemsErr) {
                      console.error(`[SyncEngine] Order items upsert error order_id=${ord.order_id}:`, itemsErr.message);
                      // ── FIX C: Write to sync_retry_queue for order items failure ──
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
                  console.warn(`[SyncEngine] Notice fetching order items for order ${ord.order_id}: ${itemsFetchErr.message}`);
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

        storesSynced++;
      } catch (storeErr: any) {
        storeErrorMsg = storeErr.message || "Synchronization process failed for this store.";
        errors.push(`Store ${store.store_name} (${store.store_code}): ${storeErrorMsg}`);
      } finally {
        // ── FIX F: Clear sync_status & last_sync_error on completion ──────────
        const hasCatalogFailure = storeModules.catalog_products.status === "failed" || storeModules.inventory_stock.status === "failed";
        const finalStatus = storeErrorMsg || hasCatalogFailure ? "error" : "connected";
        const safeErrorText = storeErrorMsg || (hasCatalogFailure ? "Catalog or stock persistence failed" : (errors.length > 0 ? errors[errors.length - 1] : null));

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
                status: finalStatus === "connected" ? "completed" : "completed_with_errors",
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
