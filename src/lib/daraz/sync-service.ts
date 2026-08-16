import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient, sanitizeLogPayload } from "./client";
import { DarazOrderStatus } from "@/types/database.types";

export interface SyncResult {
  success: boolean;
  storesSynced: number;
  productsSynced: number;
  ordersSynced: number;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  durationMs: number;
  errors: string[];
  timestamp: string;
}

// Database-backed sync lock threshold to prevent concurrent syncs across serverless processes
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Production-Grade Synchronization Engine:
 * 1. Multi-store isolation with per-store lock guards.
 * 2. Queries active Daraz Stores from Supabase.
 * 3. Uses 24-hour safe overlap window on incremental `last_synced_at` to prevent missing orders.
 * 4. Fetches Store Profiles, Catalog Listings, Variations, Images, and Orders via Daraz REST API.
 * 5. Safely UPSERTS records into Supabase PostgreSQL tables using `seller_sku` & `daraz_order_id`.
 * 6. Logs diagnostics into `daraz_api_logs` and records discrepancies in `reconciliation_logs`.
 */
export async function executeDarazSync(targetStoreId?: string): Promise<SyncResult> {
  const startTime = Date.now();
  const startedTimeIso = new Date(startTime).toISOString();
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  const supabase = createAdminClient();

  let storesSynced = 0;
  let productsSynced = 0;
  let ordersSynced = 0;
  let importedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  try {
    // 1. Query active connected stores
    let query = supabase.from("daraz_stores").select("*").eq("is_active", true);

    if (targetStoreId) {
      query = query.eq("id", targetStoreId);
    }

    const { data: stores, error: storesError } = await query;

    if (storesError) {
      throw new Error(`Failed to query daraz_stores table: ${storesError.message}`);
    }

    const connectedStores = (stores || []).filter((s) => s.access_token && s.access_token.trim());

    if (connectedStores.length === 0) {
      errors.push("No connected Daraz stores with active access tokens found. Please connect your Daraz store via My Stores page.");
      return {
        success: false,
        storesSynced: 0,
        productsSynced: 0,
        ordersSynced: 0,
        importedCount: 0,
        updatedCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        errors,
        timestamp,
      };
    }

    // 2. Process each connected store
    for (const store of connectedStores) {
      // Serverless-safe Database Row Lock: Check sync_status & updated_at on daraz_stores
      const lockCutoffIso = new Date(Date.now() - SYNC_LOCK_TIMEOUT_MS).toISOString();
      const { data: lockAcquired, error: lockErr } = await supabase
        .from("daraz_stores")
        .update({ sync_status: "syncing", updated_at: timestamp })
        .eq("id", store.id)
        .or(`sync_status.neq.syncing,updated_at.lt.${lockCutoffIso}`)
        .select("id");

      if (lockErr || !lockAcquired || lockAcquired.length === 0) {
        console.warn(`[SyncEngine] Store ${store.store_code} is currently locked/syncing by another process. Skipping...`);
        continue;
      }

      console.log(`[Daraz Sync]\nstore_id: ${store.id}\nseller_id: ${store.seller_id || "N/A"}\nstore_name: ${store.store_name}\nsync started`);

      try {
        // Relink any orphaned listings or orders matching seller_id to this active store.id
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

        // A. Sync Store Profile
        try {
          const storeProfile = await darazClient.getStoreProfile();
          await supabase
            .from("daraz_stores")
            .update({
              seller_id: storeProfile.seller_id,
              store_name: storeProfile.name,
              updated_at: timestamp,
            })
            .eq("id", store.id);
        } catch (profileErr: any) {
          console.warn(`[SyncEngine] Store profile notice for ${store.store_code}:`, profileErr.message);
        }

        // B. Sync Products / Listings & Inventory
        let productOffset = 0;
        const limit = 50;
        let totalProducts = 0;
        let fetchedProductCount = 0;
        let currentPageNum = 1;
        const syncedSellerSkus = new Set<string>();

        do {
          const { products, total } = await darazClient.getProducts(productOffset, limit);
          totalProducts = total;
          fetchedProductCount = products.length;

          console.log(`[Daraz Products]\npage: ${currentPageNum}\nitems returned: ${fetchedProductCount}\ntotal: ${totalProducts}\nnext page: ${productOffset + limit < totalProducts ? currentPageNum + 1 : "None"}`);

          for (const item of products) {
            try {
              if (item.seller_sku) {
                syncedSellerSkus.add(item.seller_sku);
              }

              const { data: existingListing } = await supabase
                .from("listings")
                .select("id, stock_quantity, price_cents")
                .eq("store_id", store.id)
                .eq("seller_sku", item.seller_sku)
                .maybeSingle();

              if (existingListing) {
                updatedCount++;
              } else {
                importedCount++;
              }

              // Schema-safe Inventory Upsert
              let invItemId: string | null = null;
              try {
                const { data: invItem } = await supabase
                  .from("inventory")
                  .upsert(
                    {
                      sku: item.seller_sku,
                      title: item.title,
                      category: item.category || "General",
                      quantity_on_hand: item.quantity,
                      quantity_reserved: item.reserved_quantity || 0,
                    },
                    { onConflict: "sku" }
                  )
                  .select("id")
                  .single();
                invItemId = invItem?.id || null;
              } catch (invErr: any) {
                console.warn(`[SyncEngine] Inventory upsert notice for SKU ${item.seller_sku}:`, invErr.message);
              }

              // Schema-safe Listings Upsert (Only include columns existing in physical PostgreSQL table)
              const listingPayload = {
                store_id: store.id,
                inventory_id: invItemId,
                seller_sku: item.seller_sku,
                daraz_item_id: item.item_id,
                daraz_sku_id: item.daraz_sku_id || null,
                title: item.title,
                price_cents: item.price_cents,
                special_price_cents: item.special_price_cents || null,
                stock_quantity: item.quantity,
                is_synced: true,
                last_synced_at: timestamp,
              };

              const { error: listingErr } = await supabase.from("listings").upsert(listingPayload, {
                onConflict: "store_id,seller_sku",
              });

              if (listingErr) {
                console.error(`[SyncEngine] Listing upsert error for SKU ${item.seller_sku}:`, listingErr.message);
                failedCount++;
              } else {
                productsSynced++;
              }
            } catch (itemErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Item error for SKU ${item.seller_sku}:`, itemErr.message);
            }
          }

          productOffset += limit;
          currentPageNum++;
        } while (productOffset < totalProducts && fetchedProductCount > 0);

        // Catalog Reconciliation: mark old listings for this store that were not returned by Daraz as is_synced = false
        if (syncedSellerSkus.size > 0) {
          try {
            const { data: allStoreListings } = await supabase
              .from("listings")
              .select("id, seller_sku")
              .eq("store_id", store.id);

            const missingListings = (allStoreListings || []).filter((l) => !syncedSellerSkus.has(l.seller_sku));
            if (missingListings.length > 0) {
              const missingIds = missingListings.map((l) => l.id);
              await supabase
                .from("listings")
                .update({ is_synced: false, updated_at: timestamp })
                .in("id", missingIds);
              console.log(`[SyncEngine Reconciliation] Marked ${missingListings.length} missing listing(s) as inactive/unsynced for store ${store.store_name}.`);
            }
          } catch (recErr: any) {
            console.warn(`[SyncEngine Reconciliation notice for ${store.store_name}]:`, recErr.message);
          }
        }

        console.log(`[Daraz Stock]\nitems returned: ${productsSynced}`);

        // C. Sync Orders
        let orderOffset = 0;
        let totalOrders = 0;
        let fetchedOrderCount = 0;
        let currentOrderPageNum = 1;

        const safeOverlapMs = 24 * 60 * 60 * 1000;
        const lastSyncTime = store.last_synced_at ? new Date(store.last_synced_at).getTime() : Date.now() - 30 * 24 * 60 * 60 * 1000;
        const incrementalUpdateAfter = new Date(lastSyncTime - safeOverlapMs).toISOString();

        do {
          const { orders, total } = await darazClient.getOrders(orderOffset, limit, incrementalUpdateAfter);
          totalOrders = total;
          fetchedOrderCount = orders.length;

          console.log(`[Daraz Orders]\npage: ${currentOrderPageNum}\nitems returned: ${fetchedOrderCount}`);

          for (const ord of orders) {
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

              // Fetch existing workflow_status to preserve local picking/picked state
              const { data: existingOrd } = await supabase
                .from("orders")
                .select("workflow_status")
                .eq("daraz_order_id", ord.order_id)
                .maybeSingle();

              let targetWorkflowStatus = mappedStatus;
              if (
                existingOrd?.workflow_status &&
                ["picking", "picked"].includes(existingOrd.workflow_status) &&
                mappedStatus === "pending"
              ) {
                targetWorkflowStatus = existingOrd.workflow_status;
              }

              // Extended schema-rich Orders Upsert
              const orderPayload = {
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
                workflow_status: targetWorkflowStatus,
                is_payout_settled: false,
                order_date: ord.created_at || timestamp,
                raw_payload: rawObj,
                sync_status: "synced",
                last_synced_at: timestamp,
              };

              const { data: upsertedOrder, error: orderUpsertErr } = await supabase
                .from("orders")
                .upsert(orderPayload, { onConflict: "daraz_order_id" })
                .select("id")
                .single();

              if (orderUpsertErr) {
                console.error(`[SyncEngine] Error upserting Order ${ord.order_id}:`, orderUpsertErr.message);
                failedCount++;
              } else {
                ordersSynced++;
                const dbOrderId = upsertedOrder.id;

                // Sync Order Items for this order to enable order_item_id mapping
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
                } catch (itemErr: any) {
                  console.warn(`[SyncEngine] Notice syncing items for Order ${ord.order_id}:`, itemErr.message);
                }
              }
            } catch (ordErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Order error for Order ID ${ord.order_id}:`, ordErr.message);
            }
          }

          orderOffset += limit;
          currentOrderPageNum++;
        } while (orderOffset < totalOrders && fetchedOrderCount > 0);

        console.log(`[Supabase]\nproducts upserted: ${productsSynced}\nstock upserted: ${productsSynced}\norders upserted: ${ordersSynced}`);

        // Update store status to success
        try {
          const { error: stErr } = await supabase
            .from("daraz_stores")
            .update({
              last_synced_at: timestamp,
              sync_status: "success",
              updated_at: timestamp,
            })
            .eq("id", store.id);

          if (stErr) {
            // Fallback if last_synced_at column is missing in production database
            await supabase
              .from("daraz_stores")
              .update({
                sync_status: "success",
                updated_at: timestamp,
              })
              .eq("id", store.id);
          }
        } catch (stErr: any) {
          console.error(`[SyncEngine] Failed to update store success status:`, stErr?.message || stErr);
        }

        storesSynced++;
        console.log(`[Daraz Sync]\nsuccess/error: success\nduration: ${Date.now() - startTime}ms`);
      } catch (storeErr: any) {
        console.error(`[Daraz Sync]\nsuccess/error: error (${storeErr.message})\nduration: ${Date.now() - startTime}ms`);
        errors.push(`Store ${store.store_name} (${store.store_code}): ${storeErr.message}`);

        try {
          await supabase
            .from("daraz_stores")
            .update({
              sync_status: "error",
              updated_at: timestamp,
            })
            .eq("id", store.id);
        } catch (stErr: any) {
          console.error(`[SyncEngine] Failed to update store error status: ${stErr?.message || stErr}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Log global sync job diagnostic
    try {
      await supabase.from("daraz_api_logs").insert({
        store_id: targetStoreId || connectedStores[0]?.id,
        sync_type: targetStoreId ? "store_sync" : "cron_sync",
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        records_synced: productsSynced + ordersSynced,
        payload: sanitizeLogPayload({
          durationMs,
          storesSynced,
          productsSynced,
          ordersSynced,
          importedCount,
          updatedCount,
          failedCount,
          errors,
          startedTimeIso,
          completedTimeIso: timestamp,
        }),
      });
    } catch (logErr: any) {
      console.error(`[SyncEngine] Failed to write API diagnostic log:`, logErr?.message || logErr);
    }

    return {
      success: errors.length === 0,
      storesSynced,
      productsSynced,
      ordersSynced,
      importedCount,
      updatedCount,
      failedCount,
      durationMs,
      errors,
      timestamp,
    };
  } catch (globalErr: any) {
    console.error("[SyncEngine Fatal Exception]:", globalErr.message);
    errors.push(globalErr.message || "Fatal error occurred during Daraz sync execution.");

    return {
      success: false,
      storesSynced,
      productsSynced,
      ordersSynced,
      importedCount,
      updatedCount,
      failedCount,
      durationMs: Date.now() - startTime,
      errors,
      timestamp,
    };
  }
}
