import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient, sanitizeLogPayload } from "./client";
import { DarazOrderStatus } from "@/types/database.types";

export interface SyncResult {
  success: boolean;
  storesSynced: number;
  productsSynced: number; // Deprecated alias for skusSynced — kept for API backwards compat
  itemsSynced: number;    // Parent Items / distinct Products count
  skusSynced: number;     // Total SKU variations persisted
  skippedItems: number;   // Items skipped due to missing stable IDs
  skippedSkus: number;    // SKUs skipped due to missing stable SellerSku
  ordersSynced: number;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  durationMs: number;
  errors: string[];
  timestamp: string;
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
 * 3. OAuth callback saves stores as `connected` — the sync engine sets `syncing` itself.
 * 4. Reconciliation (marking stale) only runs after a successful, complete full pagination.
 * 5. Items/SKUs without stable Daraz identifiers are counted, logged, and skipped (not faked).
 * 6. Inventory upsert is scoped per-store via `store_id` in listings to prevent cross-store collision.
 * 7. Post-sync DB verification logs final persisted counts for diagnostic.
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
  let totalImportedCount = 0;
  let totalUpdatedCount = 0;
  let totalFailedCount = 0;

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
      return buildResult(false, 0, 0, 0, 0, 0, 0, 0, 0, 0, Date.now() - startTime, errors, timestamp);
    }

    // ── 2. Process each connected store ──────────────────────────────────────
    for (const store of connectedStores) {
      let storeErrorMsg: string | null = null;
      let storeItemsSynced = 0;
      let storeSkusSynced = 0;
      let storeSkippedItems = 0;
      let storeSkippedSkus = 0;
      let storeOrdersSynced = 0;
      let storeImportedCount = 0;
      let storeUpdatedCount = 0;
      let storeFailedCount = 0;

      // ── 2a. Atomic database row lock ─────────────────────────────────────
      // The OAuth callback saves newly connected stores as `connected` (not `syncing`).
      // The sync engine is the only code that sets `syncing`, so this lock is safe.
      // An expired lock (> SYNC_LOCK_TIMEOUT_MS old) is automatically takeable.
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
        // ── 2b. Re-link any orphaned catalog records from duplicate store rows ──
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
            } catch (_) { /* table may not exist yet */ }
            try {
              await supabase.from("daraz_product_skus").update({ store_id: store.id }).in("store_id", sisterIds);
            } catch (_) { /* table may not exist yet */ }
            console.log(
              `[SyncEngine] Re-linked orphaned records from ${sisterIds.length} sister store(s) → store ${store.id}`
            );
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

        // ── 2c. Refresh store profile ─────────────────────────────────────
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
            console.log(
              `[SyncEngine] Store profile refreshed: seller_id=${storeProfile.seller_id} name="${storeProfile.name}"`
            );
          }
        } catch (profileErr: any) {
          console.warn(
            `[SyncEngine] Store profile notice for ${store.store_code}: ${profileErr.message} (non-fatal, continuing sync)`
          );
        }

        // ── 2d. Catalog sync with complete pagination ─────────────────────
        // paginate until Daraz returns 0 items or we exhaust the reported total
        let productOffset = 0;
        // Use the largest page size supported by Daraz (documented maximum: 500 items)
        const catalogPageSize = 500;
        let reportedTotal = 0;
        let rawItemsReturnedThisPage = 0;
        let catalogPageNum = 1;

        const syncedItemIds = new Set<string>();   // daraz_item_id values returned this sync
        const syncedSellerSkus = new Set<string>(); // seller_sku values returned this sync
        let catalogPaginationSucceeded = false;

        do {
          let pageItems;
          try {
            pageItems = await darazClient.getCatalogItems(productOffset, catalogPageSize);
          } catch (pageErr: any) {
            const msg =
              `[SyncEngine] Catalog page ${catalogPageNum} fetch error for ${store.store_code} ` +
              `(offset=${productOffset}): ${pageErr.message}`;
            console.error(msg);
            errors.push(msg);
            // Abort catalog loop — do NOT reconcile on a partial result
            break;
          }

          reportedTotal = pageItems.total_items;
          rawItemsReturnedThisPage = pageItems.raw_items_count;
          storeSkippedItems += pageItems.skipped_items;
          storeSkippedSkus += pageItems.skipped_skus;

          console.log(
            `[SyncEngine] Catalog page ${catalogPageNum} | store=${store.store_code} ` +
            `offset=${productOffset} limit=${catalogPageSize} ` +
            `returned=${rawItemsReturnedThisPage} total_reported=${reportedTotal} ` +
            `valid_items=${pageItems.items.length} ` +
            `skipped_items=${pageItems.skipped_items} skipped_skus=${pageItems.skipped_skus}`
          );

          // Process each valid catalog item
          for (const item of pageItems.items) {
            try {
              syncedItemIds.add(item.item_id);

              const itemTotalStock = item.skus.reduce((sum, s) => sum + s.quantity, 0);

              // ── Upsert parent product record ──────────────────────────
              let parentDbProductId: string | null = null;
              try {
                const { data: parentProduct } = await supabase
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

                parentDbProductId = parentProduct?.id || null;
              } catch (_) {
                /* daraz_products table may not exist — graceful skip */
              }

              storeItemsSynced++;

              // ── Upsert each SKU variation ─────────────────────────────
              for (const sku of item.skus) {
                syncedSellerSkus.add(sku.seller_sku);

                // Track import vs update for diagnostics
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

                // Upsert daraz_product_skus (optional table)
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
                      reserved_quantity: sku.reserved_quantity,
                      status: sku.status || item.status,
                      images: sku.images.length > 0 ? sku.images : item.images,
                      package_content: sku.package_content || null,
                      is_synced: true,
                      last_synced_at: timestamp,
                      updated_at: timestamp,
                    },
                    { onConflict: "store_id,seller_sku" }
                  );
                } catch (_) {
                  /* daraz_product_skus table may not exist — graceful skip */
                }

                // ── Inventory upsert ──────────────────────────────────────
                // IMPORTANT: The inventory table uses `sku` as its global unique key.
                // Two different stores CAN share the same seller_sku string. To avoid
                // one store's sync overwriting another store's inventory, we upsert
                // the listings table (which IS store-scoped) as the authoritative
                // per-store stock record, and treat `inventory` as a global sku ledger
                // (not the primary source of per-store stock truth).
                let invItemId: string | null = null;
                try {
                  const { data: invItem } = await supabase
                    .from("inventory")
                    .upsert(
                      {
                        sku: sku.seller_sku,
                        title: item.title,
                        category: item.category || "General",
                        quantity_on_hand: sku.quantity,
                        quantity_reserved: sku.reserved_quantity || 0,
                      },
                      { onConflict: "sku" }
                    )
                    .select("id")
                    .single();
                  invItemId = invItem?.id || null;
                } catch (invErr: any) {
                  console.warn(
                    `[SyncEngine] Inventory upsert notice for SKU ${sku.seller_sku}: ${invErr.message}`
                  );
                }

                // ── Listings upsert (authoritative per-store SKU record) ──
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
                } else {
                  storeSkusSynced++;
                }
              }
            } catch (itemErr: any) {
              storeFailedCount++;
              console.error(
                `[SyncEngine] Item processing error item_id=${item.item_id} store=${store.store_code}: ${itemErr.message}`
              );
            }
          }

          productOffset += rawItemsReturnedThisPage;
          catalogPageNum++;

          // Stop conditions:
          // a) API returned 0 items this page → no more pages
          // b) We have collected >= reported total items
        } while (rawItemsReturnedThisPage > 0 && productOffset < reportedTotal);

        // Mark pagination as complete only if we stopped naturally (not via break/error)
        if (rawItemsReturnedThisPage === 0 || productOffset >= reportedTotal) {
          catalogPaginationSucceeded = true;
        }

        console.log(
          `[SyncEngine] Catalog pagination complete for ${store.store_code}: ` +
          `items=${storeItemsSynced} skus=${storeSkusSynced} ` +
          `skipped_items=${storeSkippedItems} skipped_skus=${storeSkippedSkus} ` +
          `pagination_succeeded=${catalogPaginationSucceeded}`
        );

        // ── 2e. Reconciliation (stale marking) ───────────────────────────
        // REQUIREMENT: Only mark rows stale if:
        // - Pagination fully completed (not partial or errored)
        // - We actually received at least some items (non-empty API response)
        // - The synced set is non-empty
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

              console.log(
                `[SyncEngine] Reconciliation: marked ${missingListings.length} stale listings ` +
                `as is_synced=false for store ${store.store_code}`
              );
            }

            // Also reconcile daraz_products if table exists
            try {
              const { data: allStoreProducts } = await supabase
                .from("daraz_products")
                .select("id, daraz_item_id")
                .eq("store_id", store.id);

              const missingProducts = (allStoreProducts || []).filter(
                (p) => !syncedItemIds.has(p.daraz_item_id)
              );

              if (missingProducts.length > 0) {
                const missingProdIds = missingProducts.map((p) => p.id);
                await supabase
                  .from("daraz_products")
                  .update({ is_synced: false, status: "inactive", updated_at: timestamp })
                  .in("id", missingProdIds);
              }
            } catch (_) { /* table may not exist */ }

            // Write reconciliation log
            try {
              await supabase.from("reconciliation_logs").insert({
                store_id: store.id,
                total_scanned: syncedSellerSkus.size,
                discrepancy_count: missingListings.length,
                status: "completed",
                discrepancies: {
                  missing_skus_count: missingListings.length,
                  synced_items_count: syncedItemIds.size,
                  synced_skus_count: syncedSellerSkus.size,
                },
              });
            } catch (_) { /* reconciliation_logs table may not exist */ }
          } catch (recErr: any) {
            console.warn(
              `[SyncEngine] Reconciliation notice for ${store.store_name}: ${recErr.message}`
            );
          }
        } else if (!catalogPaginationSucceeded) {
          console.warn(
            `[SyncEngine] Skipping reconciliation for ${store.store_code} — ` +
            `pagination did not complete successfully (partial data protection active).`
          );
        }

        // ── 2f. Orders sync with complete pagination ──────────────────────
        let orderOffset = 0;
        const ordersPageSize = 100;
        let totalOrdersReported = 0;
        let fetchedOrdersThisPage = 0;
        let orderPageNum = 1;

        // For a targeted single-store sync or a store with no prior sync, fetch full history.
        // For scheduled cron syncs with a known last_synced_at, use a 24-hour safe overlap window.
        let incrementalUpdateAfter = "2020-01-01T00:00:00Z";
        if (!targetStoreId && store.last_synced_at) {
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
            const msg =
              `[SyncEngine] Orders page ${orderPageNum} fetch error for ${store.store_code} ` +
              `(offset=${orderOffset}): ${ordPageErr.message}`;
            console.error(msg);
            errors.push(msg);
            break;
          }

          totalOrdersReported = pageOrders.total;
          fetchedOrdersThisPage = pageOrders.orders.length;

          console.log(
            `[SyncEngine] Orders page ${orderPageNum} | store=${store.store_code} ` +
            `offset=${orderOffset} returned=${fetchedOrdersThisPage} total_reported=${totalOrdersReported}`
          );

          for (const ord of pageOrders.orders) {
            try {
              let mappedStatus: DarazOrderStatus = "pending";
              const normStatus = (ord.statuses || "").toLowerCase().replace(/[-\s]+/g, "_");

              if (["ready_to_ship", "to_ship", "to_pack"].includes(normStatus)) {
                mappedStatus = "ready_to_ship";
              } else if (["shipped", "in_transit"].includes(normStatus)) {
                mappedStatus = "shipped";
              } else if (normStatus === "delivered") {
                mappedStatus = "delivered";
              } else if (["canceled", "cancelled"].includes(normStatus)) {
                mappedStatus = "canceled";
              } else if (normStatus === "returned") {
                mappedStatus = "returned";
              } else if (normStatus === "failed") {
                mappedStatus = "failed";
              } else if (normStatus === "unpaid") {
                mappedStatus = "unpaid";
              } else {
                mappedStatus = "pending";
              }

              const rawObj = ord.raw || {};
              const shipping = rawObj.address_shipping || {};
              const billing = rawObj.address_billing || {};

              const exactFirstName = rawObj.customer_first_name || shipping.first_name || billing.first_name || "Customer";
              const exactLastName = rawObj.customer_last_name || shipping.last_name || billing.last_name || "";
              const exactCustomerName = `${exactFirstName} ${exactLastName}`.trim();
              const exactCity = ord.customer_city || shipping.city || billing.city || "Karachi";

              // Multi-tier upsert: try extended schema first, fallback to baseline columns
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
                workflow_status: mappedStatus,
                is_payout_settled: false,
                order_date: ord.created_at || timestamp,
                raw_payload: rawObj,
                sync_status: "synced",
                last_synced_at: timestamp,
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
                // Fallback to baseline columns
                const { data: baseData, error: baseErr } = await supabase
                  .from("orders")
                  .upsert(baselinePayload, { onConflict: "daraz_order_id" })
                  .select("id")
                  .single();

                if (baseErr) {
                  console.error(
                    `[SyncEngine] Order upsert failed order_id=${ord.order_id}: extended_err="${extErr.message}" baseline_err="${baseErr.message}"`
                  );
                  storeFailedCount++;
                } else {
                  dbOrderId = baseData?.id || null;
                  storeOrdersSynced++;
                }
              } else {
                dbOrderId = extData?.id || null;
                storeOrdersSynced++;
              }

              // Sync order items if order was persisted successfully
              if (dbOrderId) {
                try {
                  const items = await darazClient.getOrderItems(ord.order_id);
                  if (items && items.length > 0) {
                    const itemPayloads = items.map((item) => ({
                      order_id: dbOrderId,
                      daraz_order_id: ord.order_id,
                      order_item_id: item.order_item_id,
                      name: item.name,
                      seller_sku: item.seller_sku,
                      shop_sku: item.shop_sku || null,
                      item_price_cents: item.item_price_cents,
                      paid_price_cents: item.paid_price_cents,
                      status: item.status,
                      shipment_provider: item.shipment_provider || null,
                      tracking_code: item.tracking_code || null,
                      product_main_image: item.product_main_image || null,
                    }));

                    await supabase
                      .from("order_items")
                      .upsert(itemPayloads, { onConflict: "order_id,order_item_id" });
                  }
                } catch (_) {
                  /* order_items table may not exist — graceful skip */
                }
              }
            } catch (ordErr: any) {
              storeFailedCount++;
              console.error(
                `[SyncEngine] Order processing error order_id=${ord.order_id}: ${ordErr.message}`
              );
            }
          }

          orderOffset += fetchedOrdersThisPage;
          orderPageNum++;
        } while (fetchedOrdersThisPage > 0 && orderOffset < totalOrdersReported);

        // ── 2g. Post-sync database verification ──────────────────────────
        const { count: dbListingsCount } = await supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);

        const { count: dbOrdersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("store_id", store.id);

        console.log(
          `[SyncEngine] Post-sync verification store=${store.store_code}: ` +
          `db_listings=${dbListingsCount ?? 0} db_orders=${dbOrdersCount ?? 0} ` +
          `synced_listings=${storeSkusSynced} synced_orders=${storeOrdersSynced}`
        );

        storesSynced++;
      } catch (storeErr: any) {
        storeErrorMsg = storeErr.message || "Synchronization process failed for this store.";
        errors.push(`Store ${store.store_name} (${store.store_code}): ${storeErrorMsg}`);
        console.error(
          `[SyncEngine] Store ${store.store_code} exception: ${storeErrorMsg}`
        );
      } finally {
        // ── ALWAYS release the row lock ────────────────────────────────────
        // Success: sync_status = connected, last_synced_at = now, last_sync_error = null
        // Failure: sync_status = error, last_sync_error = exact message
        try {
          const finalStatus = storeErrorMsg ? "error" : "connected";
          await supabase
            .from("daraz_stores")
            .update({
              last_synced_at: timestamp,
              sync_status: finalStatus,
              last_sync_error: storeErrorMsg,
              updated_at: timestamp,
            })
            .eq("id", store.id);

          console.log(
            `[SyncEngine] Store ${store.store_code} lock released, final status=${finalStatus}`
          );
        } catch (finalErr: any) {
          console.error(
            `[SyncEngine] CRITICAL: Failed to release lock for store ${store.id}: ${finalErr.message}`
          );
        }

        // Accumulate totals
        totalItemsSynced += storeItemsSynced;
        totalSkusSynced += storeSkusSynced;
        totalSkippedItems += storeSkippedItems;
        totalSkippedSkus += storeSkippedSkus;
        totalOrdersSynced += storeOrdersSynced;
        totalImportedCount += storeImportedCount;
        totalUpdatedCount += storeUpdatedCount;
        totalFailedCount += storeFailedCount;
      }
    }

    const durationMs = Date.now() - startTime;

    // ── 3. Write diagnostic API log ─────────────────────────────────────────
    try {
      await supabase.from("daraz_api_logs").insert({
        store_id: targetStoreId || connectedStores[0]?.id,
        sync_type: targetStoreId ? "store_sync" : "cron_sync",
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        records_synced: totalItemsSynced + totalSkusSynced + totalOrdersSynced,
        payload: sanitizeLogPayload({
          durationMs,
          storesSynced,
          itemsSynced: totalItemsSynced,
          skusSynced: totalSkusSynced,
          skippedItems: totalSkippedItems,
          skippedSkus: totalSkippedSkus,
          ordersSynced: totalOrdersSynced,
          importedCount: totalImportedCount,
          updatedCount: totalUpdatedCount,
          failedCount: totalFailedCount,
          errors,
          startedTimeIso,
          completedTimeIso: timestamp,
        }),
      });
    } catch (logErr: any) {
      console.error(`[SyncEngine] Failed to write API diagnostic log: ${logErr.message}`);
    }

    return buildResult(
      errors.length === 0,
      storesSynced,
      totalItemsSynced,
      totalSkusSynced,
      totalSkippedItems,
      totalSkippedSkus,
      totalOrdersSynced,
      totalImportedCount,
      totalUpdatedCount,
      totalFailedCount,
      durationMs,
      errors,
      timestamp
    );
  } catch (globalErr: any) {
    console.error("[SyncEngine] Fatal exception:", globalErr.message);
    errors.push(globalErr.message || "Fatal error occurred during Daraz sync execution.");

    return buildResult(
      false,
      storesSynced,
      totalItemsSynced,
      totalSkusSynced,
      totalSkippedItems,
      totalSkippedSkus,
      totalOrdersSynced,
      totalImportedCount,
      totalUpdatedCount,
      totalFailedCount,
      Date.now() - startTime,
      errors,
      timestamp
    );
  }
}

function buildResult(
  success: boolean,
  storesSynced: number,
  itemsSynced: number,
  skusSynced: number,
  skippedItems: number,
  skippedSkus: number,
  ordersSynced: number,
  importedCount: number,
  updatedCount: number,
  failedCount: number,
  durationMs: number,
  errors: string[],
  timestamp: string
): SyncResult {
  return {
    success,
    storesSynced,
    productsSynced: skusSynced,  // backwards-compat alias
    itemsSynced,
    skusSynced,
    skippedItems,
    skippedSkus,
    ordersSynced,
    importedCount,
    updatedCount,
    failedCount,
    durationMs,
    errors,
    timestamp,
  };
}
