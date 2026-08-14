import { createAdminClient } from "@/lib/supabase/admin";
import { DarazApiClient } from "./client";
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

// Per-store in-memory sync lock map to prevent overlapping sync runs for the same store
const storeSyncLocks = new Map<string, number>();
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Production-Grade Synchronization Engine:
 * 1. Multi-store isolation with per-store lock guards.
 * 2. Queries active Daraz Stores from Supabase.
 * 3. Uses incremental `last_synced_at` timestamps for Order API calls.
 * 4. Fetches Store Profiles, Catalog Listings, Images, and Orders via Daraz REST API.
 * 5. Safely UPSERTS records into Supabase PostgreSQL tables using `seller_sku` & `daraz_order_id`.
 * 6. Logs diagnostics into `daraz_api_logs` and records mismatches in `reconciliation_logs`.
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
      // Check per-store sync lock
      const lastLock = storeSyncLocks.get(store.id);
      if (lastLock && Date.now() - lastLock < SYNC_LOCK_TIMEOUT_MS) {
        console.warn(`[SyncEngine] Store ${store.store_code} is currently syncing by another process. Skipping...`);
        continue;
      }

      // Set lock for this store
      storeSyncLocks.set(store.id, Date.now());

      try {
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

        do {
          const { products, total } = await darazClient.getProducts(productOffset, limit);
          totalProducts = total;

          for (const item of products) {
            try {
              const { data: existingListing } = await supabase
                .from("listings")
                .select("id, stock_quantity, price_cents")
                .eq("store_id", store.id)
                .eq("seller_sku", item.seller_sku)
                .maybeSingle();

              if (existingListing) {
                updatedCount++;
                // Detect stock mismatch for reconciliation log if local stock differed from Daraz truth
                if (existingListing.stock_quantity !== item.quantity) {
                  try {
                    await supabase.from("reconciliation_logs").insert({
                      store_id: store.id,
                      entity_type: "inventory",
                      entity_id: item.seller_sku,
                      daraz_value: { stock: item.quantity, price_cents: item.price_cents },
                      local_value: { stock: existingListing.stock_quantity, price_cents: existingListing.price_cents },
                      discrepancy_details: `Stock discrepancy detected: Local DB had ${existingListing.stock_quantity}, Daraz truth is ${item.quantity}. Updated local representation to match Daraz truth.`,
                      status: "auto_reconciled",
                      resolved_at: timestamp,
                    });
                  } catch (recErr) {
                    // Ignore if reconciliation table not created
                  }
                }
              } else {
                importedCount++;
              }

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

              await supabase.from("listings").upsert(
                {
                  store_id: store.id,
                  inventory_id: invItem?.id || null,
                  seller_sku: item.seller_sku,
                  daraz_item_id: item.item_id,
                  daraz_sku_id: item.daraz_sku_id || null,
                  title: item.title,
                  category: item.category || "General",
                  brand: item.brand || "Generic",
                  status: item.status || "active",
                  description: item.description || "No description provided.",
                  images: item.images || [],
                  attributes: item.attributes || {},
                  variations: item.variations || [],
                  product_url: item.product_url || null,
                  price_cents: item.price_cents,
                  special_price_cents: item.special_price_cents || null,
                  stock_quantity: item.quantity,
                  is_synced: true,
                  last_synced_at: timestamp,
                },
                { onConflict: "store_id,seller_sku" }
              );

              productsSynced++;
            } catch (itemErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Item error for SKU ${item.seller_sku}:`, itemErr.message);
            }
          }

          productOffset += limit;
        } while (productOffset < totalProducts && productOffset < 500);

        // C. Sync Orders using incremental timestamp filter
        let orderOffset = 0;
        let totalOrders = 0;

        // Use last_synced_at if available, else fall back to 30 days ago
        const incrementalUpdateAfter = store.last_synced_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        do {
          const { orders, total } = await darazClient.getOrders(orderOffset, limit, incrementalUpdateAfter);
          totalOrders = total;

          for (const ord of orders) {
            try {
              let mappedStatus: DarazOrderStatus = "pending";
              const validStatuses = ["unpaid", "pending", "ready_to_ship", "shipped", "delivered", "canceled", "returned", "failed"];
              if (validStatuses.includes(ord.statuses)) {
                mappedStatus = ord.statuses as DarazOrderStatus;
              }

              const rawObj = ord.raw || {};
              const shipping = rawObj.address_shipping || {};
              const billing = rawObj.address_billing || {};

              const exactFirstName = rawObj.customer_first_name || shipping.first_name || billing.first_name || "Customer";
              const exactLastName = rawObj.customer_last_name || shipping.last_name || billing.last_name || "";
              const exactCustomerName = `${exactFirstName} ${exactLastName}`.trim();
              const exactPhone = shipping.phone || billing.phone || rawObj.customer_phone || null;
              const exactEmail = rawObj.customer_email || shipping.email || null;
              const exactAddress =
                [shipping.address1, shipping.address2, shipping.address3, shipping.address4, shipping.address5]
                  .filter(Boolean)
                  .join(", ") || null;
              const exactProvince = shipping.address3 || shipping.state || shipping.province || null;
              const exactDistrict = shipping.address4 || shipping.district || null;
              const exactArea = shipping.address5 || shipping.area || null;
              const exactLandmark = shipping.landmark || null;
              const exactPostcode = shipping.postcode || billing.postcode || null;

              const fullOrderPayload = {
                store_id: store.id,
                daraz_order_id: ord.order_id,
                order_number: ord.order_number || ord.order_id,
                package_id: ord.package_id || null,
                tracking_number: ord.tracking_code || null,
                customer_name: exactCustomerName,
                customer_phone: exactPhone,
                customer_email: exactEmail,
                customer_address: exactAddress,
                customer_province: exactProvince,
                customer_district: exactDistrict,
                customer_area: exactArea,
                customer_landmark: exactLandmark,
                customer_postcode: exactPostcode,
                customer_city: ord.customer_city,
                customer_id: rawObj.customer_id ? String(rawObj.customer_id) : null,
                customer_notes: rawObj.remarks || rawObj.national_registration_number || null,
                total_amount_cents: ord.price_cents,
                shipping_fee_cents: ord.shipping_fee_cents || 0,
                voucher_discount_cents: ord.voucher_discount_cents || 0,
                seller_discount_cents: ord.seller_discount_cents || 0,
                shipping_provider: ord.shipping_provider || null,
                shipping_method: ord.shipping_type || null,
                payment_method: ord.payment_method || null,
                currency: rawObj.currency || "PKR",
                status: mappedStatus,
                workflow_status: mappedStatus,
                sync_status: "synced",
                sync_error: null,
                last_synced_at: timestamp,
                daraz_created_at: ord.created_at || null,
                daraz_updated_at: ord.updated_at || null,
                order_date: ord.created_at || timestamp,
                raw_payload: rawObj,
              };

              let { data: upsertedOrder, error: orderUpsertErr } = await supabase
                .from("orders")
                .upsert(fullOrderPayload, { onConflict: "daraz_order_id" })
                .select("id")
                .maybeSingle();

              if (orderUpsertErr && orderUpsertErr.message.includes("schema cache")) {
                const baseOrderPayload = {
                  store_id: store.id,
                  daraz_order_id: ord.order_id,
                  customer_name: exactCustomerName,
                  customer_city: ord.customer_city,
                  total_amount_cents: ord.price_cents,
                  status: mappedStatus,
                  tracking_number: ord.tracking_code || null,
                  order_date: ord.created_at || timestamp,
                };

                const res = await supabase
                  .from("orders")
                  .upsert(baseOrderPayload, { onConflict: "daraz_order_id" })
                  .select("id")
                  .single();

                upsertedOrder = res.data;
                orderUpsertErr = res.error;
              }

              if (orderUpsertErr || !upsertedOrder) {
                throw new Error(`Order upsert DB error: ${orderUpsertErr?.message || "Unknown error"}`);
              }

              // Fetch and upsert order line items
              if (upsertedOrder?.id) {
                try {
                  const fetchedItems = await darazClient.getOrderItems(ord.order_id);
                  for (const item of fetchedItems) {
                    await supabase.from("order_items").upsert(
                      {
                        order_id: upsertedOrder.id,
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
                        reason: item.reason || null,
                        product_main_image: item.product_main_image || null,
                        quantity: 1,
                        raw_item_payload: item as any,
                      },
                      { onConflict: "order_id,order_item_id" }
                    );
                  }
                } catch (itemErr: any) {
                  console.warn(`[SyncEngine] Order items notice for Order ${ord.order_id}:`, itemErr.message);
                }
              }

              ordersSynced++;
            } catch (ordErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Order error for Order ID ${ord.order_id}:`, ordErr.message);

              await supabase.from("sync_retry_queue").insert({
                store_id: store.id,
                operation_type: "order_sync",
                entity_type: "order",
                entity_id: ord.order_id,
                attempt_count: 1,
                error_message: ordErr.message || "Failed to process Daraz order during sync.",
                status: "failed",
                payload: ord.raw || {},
              });
            }
          }

          orderOffset += limit;
        } while (orderOffset < totalOrders && orderOffset < 500);

        // Update store last_synced_at
        await supabase
          .from("daraz_stores")
          .update({
            last_synced_at: timestamp,
            sync_status: "idle",
            last_sync_error: null,
            updated_at: timestamp,
          })
          .eq("id", store.id);

        storesSynced++;

        // Log sync diagnostics
        await supabase.from("daraz_api_logs").insert({
          store_id: store.id,
          sync_type: "full_sync",
          status: "completed",
          records_synced: productsSynced + ordersSynced,
          payload: {
            startedTime: startedTimeIso,
            finishedTime: new Date().toISOString(),
            imported: importedCount,
            updated: updatedCount,
            failed: failedCount,
            productsSynced,
            ordersSynced,
            durationMs: Date.now() - startTime,
            apiErrors: errors,
          },
        });

      } catch (storeErr: any) {
        const errorMsg = storeErr.message || String(storeErr);
        errors.push(`Store [${store.store_code}] Error: ${errorMsg}`);
        failedCount++;

        await supabase
          .from("daraz_stores")
          .update({
            sync_status: "error",
            last_sync_error: errorMsg,
            updated_at: timestamp,
          })
          .eq("id", store.id);

        await supabase.from("daraz_api_logs").insert({
          store_id: store.id,
          sync_type: "full_sync",
          status: "failed",
          error_message: errorMsg,
          payload: {
            startedTime: startedTimeIso,
            finishedTime: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            apiErrors: [errorMsg],
          },
        });
      } finally {
        storeSyncLocks.delete(store.id);
      }
    }

    return {
      success: errors.length === 0,
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
  } catch (err: any) {
    const mainError = err.message || String(err);
    errors.push(mainError);
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
