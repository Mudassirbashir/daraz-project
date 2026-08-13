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

// In-memory sync lock to prevent concurrent overlapping executions
let isSyncInProgress = false;
let syncLockTimestamp = 0;
const SYNC_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max lock duration

/**
 * Production-Grade Synchronization Engine:
 * 1. Prevents concurrent sync race conditions via lock guard.
 * 2. Queries active Daraz Stores from Supabase.
 * 3. Fetches Store Profiles, Catalog Listings, Images, and Orders via Daraz REST API.
 * 4. Safely UPSERTS records into Supabase PostgreSQL tables using `seller_sku` & `daraz_order_id` to eliminate duplicates.
 * 5. Logs complete operational diagnostics into `daraz_api_logs`.
 */
export async function executeDarazSync(): Promise<SyncResult> {
  const startTime = Date.now();
  const startedTimeIso = new Date(startTime).toISOString();
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  // Check sync lock to prevent race conditions
  if (isSyncInProgress && Date.now() - syncLockTimestamp < SYNC_LOCK_TIMEOUT_MS) {
    return {
      success: false,
      storesSynced: 0,
      productsSynced: 0,
      ordersSynced: 0,
      importedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      durationMs: 0,
      errors: ["Synchronization is already in progress by another request. Please wait."],
      timestamp,
    };
  }

  // Acquire lock
  isSyncInProgress = true;
  syncLockTimestamp = Date.now();

  const supabase = createAdminClient();

  let storesSynced = 0;
  let productsSynced = 0;
  let ordersSynced = 0;
  let importedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  try {
    // 1. Fetch active Daraz Stores from Supabase
    const { data: stores, error: storesError } = await supabase
      .from("daraz_stores")
      .select("*")
      .eq("is_active", true);

    if (storesError) {
      throw new Error(`Failed to query daraz_stores table: ${storesError.message}`);
    }

    if (!stores || stores.length === 0) {
      errors.push("No active Daraz stores found in Supabase. Please connect a Daraz store via /stores first.");
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

    // 2. Process each store synchronization
    for (const store of stores) {
      const darazClient = new DarazApiClient({
        storeId: store.id,
        accessToken: store.access_token || undefined,
        refreshToken: store.refresh_token || undefined,
        tokenExpiresAt: store.token_expires_at || undefined,
      });

      try {
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
          storesSynced++;
        } catch (profileErr: any) {
          console.warn(`[SyncEngine] Store profile notice for ${store.store_code}:`, profileErr.message);
        }

        // B. Sync Products / Listings & Inventory (with Pagination & Images)
        let productOffset = 0;
        const limit = 50;
        let totalProducts = 0;

        do {
          const { products, total } = await darazClient.getProducts(productOffset, limit);
          totalProducts = total;

          for (const item of products) {
            try {
              // Check existing listing to track imported vs updated count
              const { data: existingListing } = await supabase
                .from("listings")
                .select("id")
                .eq("store_id", store.id)
                .eq("seller_sku", item.seller_sku)
                .maybeSingle();

              if (existingListing) {
                updatedCount++;
              } else {
                importedCount++;
              }

              // Upsert inventory stock item
              const { data: invItem } = await supabase
                .from("inventory")
                .upsert(
                  {
                    sku: item.seller_sku,
                    title: item.title,
                    category: item.category || "General",
                    quantity_on_hand: item.quantity,
                    quantity_reserved: item.reserved_quantity || 0,
                    unit_cost_cents: Math.round(item.price_cents * 0.6),
                  },
                  { onConflict: "sku" }
                )
                .select("id")
                .single();

              // Upsert store listing with de-duplication on (store_id, seller_sku)
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

        // C. Sync Orders (with Pagination & Exact Payload Preservation)
        let orderOffset = 0;
        let totalOrders = 0;

        do {
          const { orders, total } = await darazClient.getOrders(orderOffset, limit);
          totalOrders = total;

          for (const ord of orders) {
            try {
              let mappedStatus: DarazOrderStatus = "pending";
              const validStatuses = ["unpaid", "pending", "ready_to_ship", "shipped", "delivered", "canceled", "returned", "failed"];
              if (validStatuses.includes(ord.statuses)) {
                mappedStatus = ord.statuses as DarazOrderStatus;
              }

              // Extract exact raw fields from Daraz raw payload
              const rawObj = ord.raw || {};
              const shipping = rawObj.address_shipping || {};
              const billing = rawObj.address_billing || {};

              const exactCustomerName =
                `${rawObj.customer_first_name || ""} ${rawObj.customer_last_name || ""}`.trim() ||
                `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim() ||
                "Customer";

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

              // Upsert order record
              const { data: upsertedOrder, error: orderUpsertErr } = await supabase.from("orders").upsert(
                {
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
                },
                { onConflict: "daraz_order_id" }
              ).select("id").single();

              if (orderUpsertErr) {
                throw new Error(`Order upsert DB error: ${orderUpsertErr.message}`);
              }

              // Fetch and upsert order items
              if (upsertedOrder?.id) {
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

                // Insert activity log
                await supabase.from("order_activities").insert({
                  order_id: upsertedOrder.id,
                  daraz_order_id: ord.order_id,
                  previous_status: null,
                  new_status: mappedStatus,
                  actor: "Daraz Engine",
                  source: "Daraz API",
                  notes: `Synced order #${ord.order_id} with status ${mappedStatus}`,
                });
              }

              ordersSynced++;
            } catch (ordErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Order error for Order ID ${ord.order_id}:`, ordErr.message);

              // Record error in sync_retry_queue for central Error Center
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

        const finishedTimeIso = new Date().toISOString();

        // D. Log Detailed Diagnostics in daraz_api_logs
        await supabase.from("daraz_api_logs").insert({
          store_id: store.id,
          sync_type: "full_sync",
          status: "completed",
          records_synced: productsSynced + ordersSynced,
          payload: {
            startedTime: startedTimeIso,
            finishedTime: finishedTimeIso,
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

        const finishedTimeIso = new Date().toISOString();

        // Log Failure in daraz_api_logs
        await supabase.from("daraz_api_logs").insert({
          store_id: store.id,
          sync_type: "full_sync",
          status: "failed",
          error_message: errorMsg,
          payload: {
            startedTime: startedTimeIso,
            finishedTime: finishedTimeIso,
            imported: importedCount,
            updated: updatedCount,
            failed: failedCount,
            durationMs: Date.now() - startTime,
            apiErrors: [errorMsg],
          },
        });
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
  } finally {
    // Release sync lock
    isSyncInProgress = false;
  }
}
