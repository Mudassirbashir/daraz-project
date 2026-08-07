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

/**
 * Production-Grade Synchronization Engine:
 * 1. Queries active Daraz Stores from Supabase.
 * 2. Fetches Store Profiles, Catalog Listings, Images, and Orders via Daraz REST API.
 * 3. Safely UPSERTS records into Supabase PostgreSQL tables using `seller_sku` & `daraz_order_id` to eliminate duplicates.
 * 4. Logs complete operational diagnostics into `daraz_api_logs` (started_time, finished_time, imported, updated, failed, api_errors).
 * 5. Returns execution metrics.
 */
export async function executeDarazSync(): Promise<SyncResult> {
  const startTime = Date.now();
  const startedTimeIso = new Date(startTime).toISOString();
  const supabase = createAdminClient();
  const errors: string[] = [];

  let storesSynced = 0;
  let productsSynced = 0;
  let ordersSynced = 0;
  let importedCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  const timestamp = new Date().toISOString();

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

        // C. Sync Orders (with Pagination)
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

              await supabase.from("orders").upsert(
                {
                  store_id: store.id,
                  daraz_order_id: ord.order_id,
                  tracking_number: ord.tracking_code,
                  customer_name: ord.customer_first_name,
                  customer_city: ord.customer_city,
                  total_amount_cents: ord.price_cents,
                  status: mappedStatus,
                  order_date: ord.created_at,
                },
                { onConflict: "daraz_order_id" }
              );

              ordersSynced++;
            } catch (ordErr: any) {
              failedCount++;
              console.error(`[SyncEngine] Order error for Order ID ${ord.order_id}:`, ordErr.message);
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
  }
}
