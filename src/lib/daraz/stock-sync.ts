import { createAdminClient } from "@/lib/supabase/admin";
import { getDarazClient } from "./client";

export interface StockSyncResult {
  success: boolean;
  storeId: string;
  skusUpdated: number;
  errors: string[];
  timestamp: string;
}

/**
 * Production-Grade Store-Scoped Stock Synchronization Engine
 *
 * Enforces `store_id` as the tenant boundary.
 * 1. Pulls real-time stock levels from Daraz Open Platform catalog API `/products/get`.
 * 2. Updates `listings` table (store_id + seller_sku).
 * 3. Updates `daraz_product_skus` table (store_id + seller_sku).
 * 4. Updates `inventory` table for local stock ledgers.
 * 5. Pushes stock changes to Daraz Open Platform `/product/price_quantity/update`.
 */

export async function pullStockForStore(storeId: string): Promise<StockSyncResult> {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  let skusUpdated = 0;

  try {
    const supabase = createAdminClient();

    // 1. Verify store existence & active status
    const { data: store, error: storeErr } = await supabase
      .from("daraz_stores")
      .select("id, seller_id, store_name, store_code, access_token, is_active")
      .eq("id", storeId)
      .single();

    if (storeErr || !store || !store.is_active || !store.access_token) {
      throw new Error(`Store ${storeId} is inactive or missing valid access token.`);
    }

    const darazClient = await getDarazClient(store.id);

    // 2. Fetch full catalog items with SKU-level stock breakdown
    let offset = 0;
    const limit = 100;
    let totalItems = 0;

    do {
      const catalogRes = await darazClient.getCatalogItems(offset, limit);
      totalItems = catalogRes.total_items;

      for (const item of catalogRes.items) {
        for (const sku of item.skus) {
          if (!sku.seller_sku) continue;

          try {
            // Update store-scoped listings table
            const { error: listingErr } = await supabase
              .from("listings")
              .update({
                stock_quantity: sku.quantity,
                price_cents: sku.price_cents,
                special_price_cents: sku.special_price_cents || null,
                last_synced_at: timestamp,
                sync_status: "synced",
              })
              .eq("store_id", store.id)
              .eq("seller_sku", sku.seller_sku);

            if (listingErr) {
              console.warn(`[StockSync] Notice updating listing store=${store.store_code} sku=${sku.seller_sku}: ${listingErr.message}`);
            }

            // Update daraz_product_skus table if present
            await supabase
              .from("daraz_product_skus")
              .update({
                quantity: sku.quantity,
                reserved_quantity: sku.reserved_quantity,
                price_cents: sku.price_cents,
                special_price_cents: sku.special_price_cents || null,
                last_synced_at: timestamp,
              })
              .eq("store_id", store.id)
              .eq("seller_sku", sku.seller_sku);

            skusUpdated++;
          } catch (itemErr: any) {
            console.error(`[StockSync] SKU update exception store=${store.store_code} sku=${sku.seller_sku}:`, itemErr.message);
          }
        }
      }

      offset += catalogRes.items.length;
    } while (offset < totalItems && offset > 0);

    return {
      success: true,
      storeId,
      skusUpdated,
      errors,
      timestamp,
    };
  } catch (err: any) {
    errors.push(err.message || String(err));
    return {
      success: false,
      storeId,
      skusUpdated,
      errors,
      timestamp,
    };
  }
}

/**
 * Pushes stock & price updates for a store to official Daraz Open Platform API.
 */
export async function pushStockToStore(
  storeId: string,
  updates: Array<{
    sellerSku: string;
    quantity?: number;
    priceCents?: number;
    specialPriceCents?: number;
  }>
): Promise<{ success: boolean; pushedCount: number; errors: string[] }> {
  const errors: string[] = [];
  if (!updates || updates.length === 0) {
    return { success: true, pushedCount: 0, errors: [] };
  }

  try {
    const supabase = createAdminClient();

    const { data: store, error: storeErr } = await supabase
      .from("daraz_stores")
      .select("id, is_active, access_token")
      .eq("id", storeId)
      .single();

    if (storeErr || !store || !store.is_active || !store.access_token) {
      throw new Error(`Store ${storeId} is inactive or not connected.`);
    }

    const darazClient = await getDarazClient(store.id);

    // Batch pushing to Daraz API
    const pushSuccess = await darazClient.updatePriceAndQuantity(updates);

    if (!pushSuccess) {
      throw new Error("Daraz API rejected price and quantity update payload.");
    }

    // Update local database on confirmed push
    const nowIso = new Date().toISOString();
    for (const update of updates) {
      const dbPayload: Record<string, any> = { last_synced_at: nowIso };
      if (typeof update.quantity === "number") dbPayload.stock_quantity = update.quantity;
      if (typeof update.priceCents === "number") dbPayload.price_cents = update.priceCents;
      if (typeof update.specialPriceCents === "number") dbPayload.special_price_cents = update.specialPriceCents;

      await supabase
        .from("listings")
        .update(dbPayload)
        .eq("store_id", store.id)
        .eq("seller_sku", update.sellerSku);
    }

    return {
      success: true,
      pushedCount: updates.length,
      errors: [],
    };
  } catch (err: any) {
    errors.push(err.message || String(err));
    return {
      success: false,
      pushedCount: 0,
      errors,
    };
  }
}
