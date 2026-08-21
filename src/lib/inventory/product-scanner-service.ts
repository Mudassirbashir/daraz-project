import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMasterSkuByBarcode } from "./barcode-mapping";

export interface ScanResolveOptions {
  storeId?: string;
  userStoreIds?: string[];
  rawInput: string;
  orderId?: string;
}

export interface ScanResolveResult {
  matched: boolean;
  rawInput: string;
  normalizedInput: string;
  storeId: string | null;
  darazItemId: string | null;
  sellerSku: string | null;
  sku: string | null;
  barcode: string | null;
  orderItemId: string | null;
  orderId: string | null;
  title: string | null;
  quantityOnHand: number;
  matchedSource: "barcode_mapping" | "listings" | "order_items" | "daraz_product_skus" | "none";
  error?: string;
}

/**
 * Normalizes scanner input handling control characters, newlines, and whitespace.
 */
export function normalizeScanInput(raw: string): string {
  if (!raw) return "";
  return raw.replace(/[\r\n\t]/g, "").trim();
}

/**
 * Centralized Product & Barcode Scanner Resolution Service
 * Handles normalized input, store isolation, and multi-field identity resolution.
 */
export async function resolveScannedProduct(
  options: ScanResolveOptions
): Promise<ScanResolveResult> {
  const rawInput = options.rawInput || "";
  const normalizedInput = normalizeScanInput(rawInput);

  if (!normalizedInput) {
    return {
      matched: false,
      rawInput,
      normalizedInput: "",
      storeId: options.storeId || null,
      darazItemId: null,
      sellerSku: null,
      sku: null,
      barcode: null,
      orderItemId: null,
      orderId: options.orderId || null,
      title: null,
      quantityOnHand: 0,
      matchedSource: "none",
      error: "Empty scanner input provided.",
    };
  }

  const supabase = createAdminClient();

  // 1. Check Barcode Mapping table
  try {
    const { masterSkuId, masterSku } = await resolveMasterSkuByBarcode(
      normalizedInput,
      options.storeId
    );

    if (masterSkuId || masterSku) {
      const matchSku = masterSku || normalizedInput;
      let listingQuery = supabase.from("listings").select("*, daraz_stores(id, store_name)");
      if (options.storeId) {
        listingQuery = listingQuery.eq("store_id", options.storeId);
      } else if (options.userStoreIds && options.userStoreIds.length > 0) {
        listingQuery = listingQuery.in("store_id", options.userStoreIds);
      }

      listingQuery = listingQuery.or(`seller_sku.ilike.${matchSku},seller_sku.ilike.${normalizedInput}`);
      const { data: listingData } = await listingQuery.maybeSingle();

      if (listingData) {
        return {
          matched: true,
          rawInput,
          normalizedInput,
          storeId: listingData.store_id,
          darazItemId: listingData.daraz_item_id || null,
          sellerSku: listingData.seller_sku,
          sku: listingData.seller_sku,
          barcode: normalizedInput,
          orderItemId: null,
          orderId: options.orderId || null,
          title: listingData.title || null,
          quantityOnHand: listingData.stock_quantity || 0,
          matchedSource: "barcode_mapping",
        };
      }
    }
  } catch (err: any) {
    console.warn(`[Scanner Service] Barcode mapping notice: ${err?.message}`);
  }

  // 2. Check Order Items if orderId context is provided
  if (options.orderId) {
    try {
      const { data: orderItemData } = await supabase
        .from("order_items")
        .select("*, orders(store_id)")
        .eq("order_id", options.orderId)
        .or(`seller_sku.ilike.${normalizedInput},order_item_id.eq.${normalizedInput},name.ilike.%${normalizedInput}%`)
        .maybeSingle();

      if (orderItemData) {
        return {
          matched: true,
          rawInput,
          normalizedInput,
          storeId: orderItemData.store_id || orderItemData.orders?.store_id || options.storeId || null,
          darazItemId: orderItemData.product_id || null,
          sellerSku: orderItemData.seller_sku,
          sku: orderItemData.seller_sku,
          barcode: null,
          orderItemId: orderItemData.order_item_id || orderItemData.id,
          orderId: options.orderId,
          title: orderItemData.name || null,
          quantityOnHand: orderItemData.quantity || 1,
          matchedSource: "order_items",
        };
      }
    } catch (err: any) {
      console.warn(`[Scanner Service] Order items notice: ${err?.message}`);
    }
  }

  // 3. Direct Listing SKU search
  try {
    let query = supabase.from("listings").select("*, daraz_stores(id, store_name)");
    if (options.storeId) {
      query = query.eq("store_id", options.storeId);
    } else if (options.userStoreIds && options.userStoreIds.length > 0) {
      query = query.in("store_id", options.userStoreIds);
    }

    const { data: listingMatch } = await query
      .or(`seller_sku.ilike.${normalizedInput},daraz_item_id.eq.${normalizedInput},title.ilike.%${normalizedInput}%`)
      .maybeSingle();

    if (listingMatch) {
      return {
        matched: true,
        rawInput,
        normalizedInput,
        storeId: listingMatch.store_id,
        darazItemId: listingMatch.daraz_item_id || null,
        sellerSku: listingMatch.seller_sku,
        sku: listingMatch.seller_sku,
        barcode: null,
        orderItemId: null,
        orderId: options.orderId || null,
        title: listingMatch.title || null,
        quantityOnHand: listingMatch.stock_quantity || 0,
        matchedSource: "listings",
      };
    }
  } catch (err: any) {
    console.warn(`[Scanner Service] Listing SKU notice: ${err?.message}`);
  }

  return {
    matched: false,
    rawInput,
    normalizedInput,
    storeId: options.storeId || null,
    darazItemId: null,
    sellerSku: null,
    sku: null,
    barcode: null,
    orderItemId: null,
    orderId: options.orderId || null,
    title: null,
    quantityOnHand: 0,
    matchedSource: "none",
    error: `Product with barcode/SKU '${normalizedInput}' not found for store.`,
  };
}
