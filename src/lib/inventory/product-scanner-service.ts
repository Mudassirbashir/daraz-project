import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMasterSkuByBarcode } from "./barcode-mapping";

export type ScannedMatchType =
  | "barcode"
  | "seller_sku"
  | "sku"
  | "tracking_number"
  | "order_id"
  | "order_item_id"
  | "product_id";

export interface ScanMatchItem {
  matchType: ScannedMatchType;
  storeId: string;
  orderId: string;
  darazOrderId: string;
  orderItemId: string;
  sellerSku: string;
  sku: string;
  barcode: string | null;
  productId: string | null;
  productName: string;
  quantity: number;
  orderStatus: string;
  trackingNumber: string | null;
  // Nested sub-objects required by specification
  store?: {
    id: string;
    name?: string;
    [key: string]: any;
  };
  order?: {
    id: string;
    daraz_order_id: string;
    tracking_number?: string | null;
    status?: string;
    customer_name?: string | null;
    [key: string]: any;
  };
  orderItem?: {
    id: string;
    order_item_id: string;
    seller_sku: string;
    name: string;
    quantity: number;
    [key: string]: any;
  };
  product?: {
    id: string | null;
    name: string;
    seller_sku: string;
    barcode?: string | null;
    [key: string]: any;
  };
  // Backward compatibility snake_case fields
  store_id?: string;
  order_id?: string;
  daraz_order_id?: string;
  order_item_id?: string;
  seller_sku?: string;
  product_id?: string | null;
  product_name?: string;
  order_status?: string;
  tracking_number?: string | null;
}

export type ScanErrorCode =
  | "SCAN_NOT_FOUND"
  | "STORE_NOT_AUTHORIZED"
  | "MULTIPLE_MATCHES"
  | "INVALID_INPUT"
  | "DATABASE_ERROR";

export interface ScanResolveOptions {
  storeId?: string;
  userStoreIds?: string[];
  rawInput: string;
  orderId?: string;
  fixtures?: Record<string, any[]>;
}

export interface ScanResolveResult {
  success: boolean;
  code?: ScanErrorCode;
  message?: string;
  matchType?: ScannedMatchType;
  storeId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  sellerSku?: string | null;
  barcode?: string | null;
  productId?: string | null;
  productName?: string | null;
  quantity?: number;
  store?: any;
  order?: any;
  orderItem?: any;
  product?: any;
  match?: ScanMatchItem;
  matches?: ScanMatchItem[];
  // Legacy compatibility fields
  matched: boolean;
  rawInput: string;
  normalizedInput: string;
  darazOrderId?: string;
  darazItemId?: string | null;
  sku?: string | null;
  title?: string | null;
  quantityOnHand?: number;
  matchedSource?: "order_identifiers" | "order_items" | "barcode_mapping" | "listings" | "daraz_product_skus" | "none";
  error?: string;
}

/**
 * Normalizes scanner input:
 * - trims surrounding whitespace
 * - strips accidental line breaks / control characters (\r, \n, \t, \f, \v)
 * - preserves numeric IDs as string (does not strip leading zeros or lose precision)
 * - preserves meaningful SKU characters (hyphens, slashes, underscores, dots)
 */
export function normalizeScanValue(raw: string): string {
  if (!raw) return "";
  return String(raw)
    .replace(/[\r\n\t\f\v]/g, "")
    .trim();
}

/**
 * Alias for backward compatibility
 */
export function normalizeScanInput(raw: string): string {
  return normalizeScanValue(raw);
}

/**
 * Shared scanner resolution entry point.
 * Calls API when in browser context, or calls backend resolution directly when on server.
 */
export async function resolveScannedIdentifier(
  options: ScanResolveOptions
): Promise<ScanResolveResult> {
  const rawInput = options.rawInput || "";
  const normalizedInput = normalizeScanValue(rawInput);

  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/inventory/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: normalizedInput,
          storeId: options.storeId,
          orderId: options.orderId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          code: data.code || "SCAN_NOT_FOUND",
          message: data.message || data.error || `No matching item or order found for scan '${normalizedInput}'`,
          matches: data.matches || [],
          matched: false,
          rawInput,
          normalizedInput,
          storeId: options.storeId || null,
          orderId: options.orderId || null,
          error: data.message || data.error || "Scan resolution failed.",
        };
      }

      const match = data.match;
      return {
        success: true,
        code: data.code,
        message: data.message,
        matchType: data.matchType || match?.matchType || "seller_sku",
        storeId: data.storeId || match?.storeId || match?.store_id || null,
        orderId: data.orderId || match?.orderId || match?.order_id || null,
        orderItemId: data.orderItemId || match?.orderItemId || match?.order_item_id || null,
        sellerSku: data.sellerSku || match?.sellerSku || match?.seller_sku || null,
        barcode: data.barcode || match?.barcode || null,
        productId: data.productId || match?.productId || match?.product_id || null,
        productName: data.productName || match?.productName || match?.product_name || null,
        quantity: data.quantity ?? match?.quantity ?? 1,
        store: data.store || match?.store,
        order: data.order || match?.order,
        orderItem: data.orderItem || match?.orderItem,
        product: data.product || match?.product,
        match,
        matches: data.matches || [],
        matched: true,
        rawInput,
        normalizedInput,
      };
    } catch (err: any) {
      return {
        success: false,
        code: "DATABASE_ERROR",
        message: err.message || "Failed to communicate with scanner service.",
        matched: false,
        rawInput,
        normalizedInput,
        storeId: options.storeId || null,
        orderId: options.orderId || null,
        error: err.message || "Network or server error during scan resolution.",
      };
    }
  }

  // Direct server-side execution
  return await resolveScannedProduct(options);
}

/**
 * Centralized Product & Order Barcode Scanner Resolution Service (Server Engine)
 * Supports: Daraz Order ID, Daraz Order Item ID, Seller SKU, SKU, Barcode, Tracking Number
 */
export async function resolveScannedProduct(
  options: ScanResolveOptions
): Promise<ScanResolveResult> {
  if (options.fixtures) {
    return resolveScannedProductInMemory(options, options.fixtures);
  }

  const rawInput = options.rawInput || "";
  const normalizedInput = normalizeScanValue(rawInput);

  if (!normalizedInput) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Scanner input string is empty or invalid.",
      matched: false,
      rawInput,
      normalizedInput: "",
      storeId: options.storeId || null,
      orderId: options.orderId || null,
      darazItemId: null,
      sellerSku: null,
      sku: null,
      barcode: null,
      orderItemId: null,
      title: null,
      quantityOnHand: 0,
      matchedSource: "none",
      error: "Scanner input string is empty or invalid.",
    };
  }

  const supabase = createAdminClient();

  try {
    // 1. Resolve & Authorize Store Context
    let allowedStoreIds: string[] = [];

    if (options.storeId) {
      if (options.userStoreIds && options.userStoreIds.length > 0 && !options.userStoreIds.includes(options.storeId)) {
        return {
          success: false,
          code: "STORE_NOT_AUTHORIZED",
          message: "User is not authorized for the requested store.",
          matched: false,
          rawInput,
          normalizedInput,
          storeId: options.storeId,
          orderId: options.orderId || null,
          matchedSource: "none",
          error: "User is not authorized for the requested store.",
        };
      }
      allowedStoreIds = [options.storeId];
    } else if (options.userStoreIds && options.userStoreIds.length > 0) {
      allowedStoreIds = options.userStoreIds;
    } else {
      const { data: stores } = await supabase
        .from("daraz_stores")
        .select("id")
        .eq("is_active", true);

      allowedStoreIds = (stores || []).map((s) => s.id);
    }

    if (allowedStoreIds.length === 0) {
      return {
        success: false,
        code: "STORE_NOT_AUTHORIZED",
        message: "No matching active stores authorized for scanner.",
        matched: false,
        rawInput,
        normalizedInput,
        storeId: null,
        orderId: options.orderId || null,
        matchedSource: "none",
        error: "No matching active stores authorized for scanner.",
      };
    }

    const candidateMatches: ScanMatchItem[] = [];
    let matchedSource: ScanResolveResult["matchedSource"] = "none";

    // 2. Search Order Identifiers (Daraz Order ID, Tracking Number, Order UUID)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedInput);
    let orderQuery = supabase
      .from("orders")
      .select("*, order_items(*), daraz_stores(*)")
      .in("store_id", allowedStoreIds);

    if (options.orderId) {
      orderQuery = orderQuery.eq("id", options.orderId);
    }

    if (isUuid) {
      orderQuery = orderQuery.or(`id.eq.${normalizedInput},daraz_order_id.ilike.${normalizedInput},tracking_number.ilike.${normalizedInput}`);
    } else {
      orderQuery = orderQuery.or(`daraz_order_id.ilike.${normalizedInput},tracking_number.ilike.${normalizedInput}`);
    }

    const { data: matchedOrders } = await orderQuery;

    if (matchedOrders && matchedOrders.length > 0) {
      matchedSource = "order_identifiers";
      for (const ord of matchedOrders) {
        const matchType: ScannedMatchType = 
          ord.tracking_number?.toLowerCase() === normalizedInput.toLowerCase()
            ? "tracking_number"
            : "order_id";

        const items = Array.isArray(ord.order_items) && ord.order_items.length > 0 ? ord.order_items : [null];
        for (const item of items) {
          const itemSellerSku = item?.seller_sku || item?.sku || "";
          const itemBarcode = item?.barcode || null;
          const itemProductName = item?.name || "Order Package Item";
          const itemQty = item?.quantity || 1;
          const itemOrdItemId = item?.order_item_id || item?.id || "";

          candidateMatches.push({
            matchType,
            storeId: ord.store_id,
            orderId: ord.id,
            darazOrderId: ord.daraz_order_id,
            orderItemId: itemOrdItemId,
            sellerSku: itemSellerSku,
            sku: itemSellerSku,
            barcode: itemBarcode,
            productId: item?.product_id || null,
            productName: itemProductName,
            quantity: itemQty,
            orderStatus: ord.status || "pending",
            trackingNumber: ord.tracking_number || null,

            // Sub-objects
            store: { id: ord.store_id, name: ord.daraz_stores?.name || "Daraz Store" },
            order: { id: ord.id, daraz_order_id: ord.daraz_order_id, tracking_number: ord.tracking_number, status: ord.status, customer_name: ord.customer_name },
            orderItem: { id: itemOrdItemId, order_item_id: itemOrdItemId, seller_sku: itemSellerSku, name: itemProductName, quantity: itemQty },
            product: { id: item?.product_id || null, name: itemProductName, seller_sku: itemSellerSku, barcode: itemBarcode },

            // Snake case compatibility
            store_id: ord.store_id,
            order_id: ord.id,
            daraz_order_id: ord.daraz_order_id,
            order_item_id: itemOrdItemId,
            seller_sku: itemSellerSku,
            product_id: item?.product_id || null,
            product_name: itemProductName,
            order_status: ord.status || "pending",
            tracking_number: ord.tracking_number || null,
          });
        }
      }
    }

    // 3. Search Order Items (Order Item ID, Seller SKU, SKU)
    let itemQuery = supabase
      .from("order_items")
      .select("*, orders(*, daraz_stores(*))")
      .in("store_id", allowedStoreIds);

    if (options.orderId) {
      itemQuery = itemQuery.eq("order_id", options.orderId);
    }

    itemQuery = itemQuery.or(`order_item_id.ilike.${normalizedInput},seller_sku.ilike.${normalizedInput},sku.ilike.${normalizedInput}`);

    const { data: matchedItems } = await itemQuery;

    if (matchedItems && matchedItems.length > 0) {
      if (matchedSource === "none") matchedSource = "order_items";
      for (const item of matchedItems) {
        const ord = item.orders || {};
        const matchType: ScannedMatchType =
          item.order_item_id?.toLowerCase() === normalizedInput.toLowerCase()
            ? "order_item_id"
            : "seller_sku";

        const itemOrdItemId = item.order_item_id || item.id || "";
        const itemSellerSku = item.seller_sku || item.sku || "";
        const itemProductName = item.name || "Order Item";
        const itemQty = item.quantity || 1;

        candidateMatches.push({
          matchType,
          storeId: item.store_id || ord.store_id || allowedStoreIds[0],
          orderId: item.order_id,
          darazOrderId: ord.daraz_order_id || "",
          orderItemId: itemOrdItemId,
          sellerSku: itemSellerSku,
          sku: itemSellerSku,
          barcode: item.barcode || null,
          productId: item.product_id || null,
          productName: itemProductName,
          quantity: itemQty,
          orderStatus: ord.status || "pending",
          trackingNumber: ord.tracking_number || null,

          // Sub-objects
          store: { id: item.store_id || ord.store_id || allowedStoreIds[0], name: ord.daraz_stores?.name || "Daraz Store" },
          order: { id: item.order_id, daraz_order_id: ord.daraz_order_id, tracking_number: ord.tracking_number, status: ord.status, customer_name: ord.customer_name },
          orderItem: { id: itemOrdItemId, order_item_id: itemOrdItemId, seller_sku: itemSellerSku, name: itemProductName, quantity: itemQty },
          product: { id: item.product_id || null, name: itemProductName, seller_sku: itemSellerSku, barcode: item.barcode || null },

          // Snake case compatibility
          store_id: item.store_id || ord.store_id || allowedStoreIds[0],
          order_id: item.order_id,
          daraz_order_id: ord.daraz_order_id || "",
          order_item_id: itemOrdItemId,
          seller_sku: itemSellerSku,
          product_id: item.product_id || null,
          product_name: itemProductName,
          order_status: ord.status || "pending",
          tracking_number: ord.tracking_number || null,
        });
      }
    }

    // 4. Search Product & Barcode Mapping
    if (candidateMatches.length === 0) {
      const { masterSku } = await resolveMasterSkuByBarcode(normalizedInput, options.storeId);
      const searchSku = masterSku || normalizedInput;

      // Check listings / product SKUs in store
      const { data: listingMatches } = await supabase
        .from("listings")
        .select("*")
        .in("store_id", allowedStoreIds)
        .or(`seller_sku.ilike.${searchSku},seller_sku.ilike.${normalizedInput},daraz_item_id.ilike.${normalizedInput},title.ilike.%${normalizedInput}%`);

      if (listingMatches && listingMatches.length > 0) {
        matchedSource = "barcode_mapping";
        for (const listing of listingMatches) {
          const matchType: ScannedMatchType = 
            listing.daraz_item_id?.toLowerCase() === normalizedInput.toLowerCase()
              ? "product_id"
              : "barcode";

          // Check if there are active order items matching this listing
          const { data: activeOrderItems } = await supabase
            .from("order_items")
            .select("*, orders(*, daraz_stores(*))")
            .in("store_id", allowedStoreIds)
            .ilike("seller_sku", listing.seller_sku)
            .limit(5);

          if (activeOrderItems && activeOrderItems.length > 0) {
            for (const item of activeOrderItems) {
              const ord = item.orders || {};
              const itemOrdItemId = item.order_item_id || item.id || "";
              const itemProductName = listing.title || item.name || "Catalog Product";
              const itemQty = item.quantity || 1;

              candidateMatches.push({
                matchType,
                storeId: listing.store_id,
                orderId: item.order_id,
                darazOrderId: ord.daraz_order_id || "",
                orderItemId: itemOrdItemId,
                sellerSku: listing.seller_sku,
                sku: listing.seller_sku,
                barcode: normalizedInput,
                productId: listing.daraz_item_id || null,
                productName: itemProductName,
                quantity: itemQty,
                orderStatus: ord.status || "pending",
                trackingNumber: ord.tracking_number || null,

                // Sub-objects
                store: { id: listing.store_id, name: ord.daraz_stores?.name || "Daraz Store" },
                order: { id: item.order_id, daraz_order_id: ord.daraz_order_id, tracking_number: ord.tracking_number, status: ord.status, customer_name: ord.customer_name },
                orderItem: { id: itemOrdItemId, order_item_id: itemOrdItemId, seller_sku: listing.seller_sku, name: itemProductName, quantity: itemQty },
                product: { id: listing.daraz_item_id || null, name: itemProductName, seller_sku: listing.seller_sku, barcode: normalizedInput },

                // Snake case compatibility
                store_id: listing.store_id,
                order_id: item.order_id,
                daraz_order_id: ord.daraz_order_id || "",
                order_item_id: itemOrdItemId,
                seller_sku: listing.seller_sku,
                product_id: listing.daraz_item_id || null,
                product_name: itemProductName,
                order_status: ord.status || "pending",
                tracking_number: ord.tracking_number || null,
              });
            }
          } else {
            // Standalone listing match (product scan without order)
            const itemProductName = listing.title || "Catalog Product";
            const itemQty = listing.stock_quantity || 1;

            candidateMatches.push({
              matchType,
              storeId: listing.store_id,
              orderId: options.orderId || "",
              darazOrderId: "",
              orderItemId: "",
              sellerSku: listing.seller_sku,
              sku: listing.seller_sku,
              barcode: normalizedInput,
              productId: listing.daraz_item_id || null,
              productName: itemProductName,
              quantity: itemQty,
              orderStatus: "inventory",
              trackingNumber: null,

              // Sub-objects
              store: { id: listing.store_id, name: "Daraz Store" },
              order: { id: options.orderId || "", daraz_order_id: "", tracking_number: null, status: "inventory" },
              orderItem: { id: "", order_item_id: "", seller_sku: listing.seller_sku, name: itemProductName, quantity: itemQty },
              product: { id: listing.daraz_item_id || null, name: itemProductName, seller_sku: listing.seller_sku, barcode: normalizedInput },

              // Snake case compatibility
              store_id: listing.store_id,
              order_id: options.orderId || "",
              daraz_order_id: "",
              order_item_id: "",
              seller_sku: listing.seller_sku,
              product_id: listing.daraz_item_id || null,
              product_name: itemProductName,
              order_status: "inventory",
              tracking_number: null,
            });
          }
        }
      }
    }

    // 5. Deduplicate Candidate Matches
    const uniqueMap = new Map<string, ScanMatchItem>();
    for (const m of candidateMatches) {
      const key = `${m.storeId}_${m.orderId}_${m.orderItemId}_${m.sellerSku}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, m);
      }
    }
    const deduplicatedMatches = Array.from(uniqueMap.values());

    // 6. Evaluate Results
    if (deduplicatedMatches.length === 0) {
      return {
        success: false,
        code: "SCAN_NOT_FOUND",
        message: `No matching order or product was found for input '${normalizedInput}'.`,
        matched: false,
        rawInput,
        normalizedInput,
        storeId: options.storeId || allowedStoreIds[0] || null,
        orderId: options.orderId || null,
        darazItemId: null,
        sellerSku: null,
        sku: null,
        barcode: null,
        orderItemId: null,
        title: null,
        quantityOnHand: 0,
        matchedSource: "none",
        error: `No matching order or product was found for input '${normalizedInput}'.`,
      };
    }

    if (deduplicatedMatches.length === 1) {
      const match = deduplicatedMatches[0];
      return {
        success: true,
        match,
        matchType: match.matchType,
        storeId: match.storeId,
        orderId: match.orderId,
        orderItemId: match.orderItemId,
        sellerSku: match.sellerSku,
        barcode: match.barcode,
        productId: match.productId,
        productName: match.productName,
        quantity: match.quantity,
        store: match.store,
        order: match.order,
        orderItem: match.orderItem,
        product: match.product,

        matched: true,
        rawInput,
        normalizedInput,
        darazOrderId: match.darazOrderId,
        sku: match.sku,
        title: match.productName,
        quantityOnHand: match.quantity,
        matchedSource: matchedSource || "order_items",
      };
    }

    // Multiple Matches Found
    return {
      success: false,
      code: "MULTIPLE_MATCHES",
      message: `Multiple (${deduplicatedMatches.length}) matching orders or items found for scan '${normalizedInput}'.`,
      matches: deduplicatedMatches,
      matched: false,
      rawInput,
      normalizedInput,
      storeId: options.storeId || null,
      orderId: options.orderId || null,
      matchedSource: matchedSource || "order_items",
      error: `Multiple (${deduplicatedMatches.length}) matching orders or items found for scan '${normalizedInput}'.`,
    };
  } catch (err: any) {
    console.error("[Scanner Service Exception]:", err?.message);
    return {
      success: false,
      code: "DATABASE_ERROR",
      message: err.message || "Failed to perform store scanning query.",
      matched: false,
      rawInput,
      normalizedInput,
      storeId: options.storeId || null,
      orderId: options.orderId || null,
      matchedSource: "none",
      error: err.message || "Failed to perform store scanning query.",
    };
  }
}

/**
 * In-memory scanner resolution logic for test fixtures & offline validation.
 */
export function resolveScannedProductInMemory(
  options: ScanResolveOptions,
  fixtures: Record<string, any[]>
): ScanResolveResult {
  const rawInput = options.rawInput || "";
  const normalizedInput = normalizeScanValue(rawInput);

  if (!normalizedInput) {
    return {
      success: false,
      code: "INVALID_INPUT",
      message: "Scanner input string is empty or invalid.",
      matched: false,
      rawInput,
      normalizedInput: "",
      storeId: options.storeId || null,
      orderId: options.orderId || null,
      matchedSource: "none",
      error: "Scanner input string is empty or invalid.",
    };
  }

  let allowedStoreIds = Object.keys(fixtures);
  if (options.storeId) {
    if (options.userStoreIds && options.userStoreIds.length > 0 && !options.userStoreIds.includes(options.storeId)) {
      return {
        success: false,
        code: "STORE_NOT_AUTHORIZED",
        message: "User is not authorized for the requested store.",
        matched: false,
        rawInput,
        normalizedInput,
        storeId: options.storeId,
        matchedSource: "none",
        error: "User is not authorized for the requested store.",
      };
    }
    allowedStoreIds = allowedStoreIds.filter((id) => id === options.storeId);
  } else if (options.userStoreIds && options.userStoreIds.length > 0) {
    allowedStoreIds = allowedStoreIds.filter((id) => options.userStoreIds!.includes(id));
  }

  if (allowedStoreIds.length === 0) {
    return {
      success: false,
      code: "STORE_NOT_AUTHORIZED",
      message: "No matching active stores authorized for scanner.",
      matched: false,
      rawInput,
      normalizedInput,
      storeId: null,
      matchedSource: "none",
      error: "No matching active stores authorized for scanner.",
    };
  }

  const candidateMatches: ScanMatchItem[] = [];

  for (const storeId of allowedStoreIds) {
    const storeFixtures = fixtures[storeId] || [];
    for (const item of storeFixtures) {
      if (options.orderId && item.order_id !== options.orderId && item.daraz_order_id !== options.orderId) {
        continue;
      }

      const inputLower = normalizedInput.toLowerCase();
      let matchType: ScannedMatchType | null = null;

      if ((item.daraz_order_id && item.daraz_order_id.toLowerCase() === inputLower) || (item.order_id && item.order_id.toLowerCase() === inputLower)) {
        matchType = "order_id";
      } else if (item.order_item_id && item.order_item_id.toLowerCase() === inputLower) {
        matchType = "order_item_id";
      } else if (item.seller_sku && item.seller_sku.toLowerCase() === inputLower) {
        matchType = "seller_sku";
      } else if (item.sku && item.sku.toLowerCase() === inputLower) {
        matchType = "seller_sku";
      } else if (item.barcode && (item.barcode === normalizedInput || item.barcode.toLowerCase() === inputLower)) {
        matchType = "barcode";
      } else if (item.tracking_number && item.tracking_number.toLowerCase() === inputLower) {
        matchType = "tracking_number";
      }

      if (matchType) {
        const itemOrdItemId = item.order_item_id || item.id || "";
        const itemSellerSku = item.seller_sku || item.sku || "";
        const itemSku = item.sku || item.seller_sku || "";
        const itemProductName = item.product_name || item.name || "Order Item";
        const itemQty = item.quantity || 1;
        const itemBarcode = item.barcode || null;
        const itemDarazOrderId = item.daraz_order_id || item.order_id || "";
        const itemOrderId = item.order_id || "";
        const itemTrackingNumber = item.tracking_number || null;
        const itemOrderStatus = item.order_status || item.status || "pending";

        candidateMatches.push({
          matchType,
          storeId: item.store_id || storeId,
          orderId: itemOrderId,
          darazOrderId: itemDarazOrderId,
          orderItemId: itemOrdItemId,
          sellerSku: itemSellerSku,
          sku: itemSku,
          barcode: itemBarcode,
          productId: item.product_id || null,
          productName: itemProductName,
          quantity: itemQty,
          orderStatus: itemOrderStatus,
          trackingNumber: itemTrackingNumber,

          store: { id: item.store_id || storeId, name: `Daraz Store ${item.store_id || storeId}` },
          order: { id: itemOrderId, daraz_order_id: itemDarazOrderId, tracking_number: itemTrackingNumber, status: itemOrderStatus },
          orderItem: { id: itemOrdItemId, order_item_id: itemOrdItemId, seller_sku: itemSellerSku, name: itemProductName, quantity: itemQty },
          product: { id: item.product_id || null, name: itemProductName, seller_sku: itemSellerSku, barcode: itemBarcode },

          store_id: item.store_id || storeId,
          order_id: itemOrderId,
          daraz_order_id: itemDarazOrderId,
          order_item_id: itemOrdItemId,
          seller_sku: itemSellerSku,
          product_id: item.product_id || null,
          product_name: itemProductName,
          order_status: itemOrderStatus,
          tracking_number: itemTrackingNumber,
        });
      }
    }
  }

  // Deduplicate
  const uniqueMap = new Map<string, ScanMatchItem>();
  for (const m of candidateMatches) {
    const key = `${m.storeId}_${m.orderId}_${m.orderItemId}_${m.sellerSku}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, m);
    }
  }
  const deduplicatedMatches = Array.from(uniqueMap.values());

  if (deduplicatedMatches.length === 0) {
    return {
      success: false,
      code: "SCAN_NOT_FOUND",
      message: `No matching order or product was found for input '${normalizedInput}'.`,
      matched: false,
      rawInput,
      normalizedInput,
      storeId: options.storeId || allowedStoreIds[0] || null,
      orderId: options.orderId || null,
      matchedSource: "none",
      error: `No matching order or product was found for input '${normalizedInput}'.`,
    };
  }

  if (deduplicatedMatches.length === 1) {
    const match = deduplicatedMatches[0];
    return {
      success: true,
      match,
      matchType: match.matchType,
      storeId: match.storeId,
      orderId: match.orderId,
      orderItemId: match.orderItemId,
      sellerSku: match.sellerSku,
      barcode: match.barcode,
      productId: match.productId,
      productName: match.productName,
      quantity: match.quantity,
      store: match.store,
      order: match.order,
      orderItem: match.orderItem,
      product: match.product,
      matched: true,
      rawInput,
      normalizedInput,
      darazOrderId: match.darazOrderId,
      sku: match.sku,
      title: match.productName,
      quantityOnHand: match.quantity,
      matchedSource: "order_items",
    };
  }

  return {
    success: false,
    code: "MULTIPLE_MATCHES",
    message: `Multiple (${deduplicatedMatches.length}) matching orders or items found for scan '${normalizedInput}'.`,
    matches: deduplicatedMatches,
    matched: false,
    rawInput,
    normalizedInput,
    storeId: options.storeId || null,
    orderId: options.orderId || null,
    matchedSource: "order_items",
    error: `Multiple (${deduplicatedMatches.length}) matching orders or items found for scan '${normalizedInput}'.`,
  };
}


