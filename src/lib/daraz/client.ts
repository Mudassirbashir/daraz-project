import { generateDarazSignature } from "./signature";
import { createAdminClient } from "../supabase/admin";

export interface DarazStoreProfile {
  seller_id: string;
  name: string;
  short_code: string;
  email: string;
  location: string;
}

export interface DarazProductSku {
  seller_sku: string;
  daraz_sku_id: string;
  shop_sku: string;
  item_id: string;
  price_cents: number;
  special_price_cents?: number;
  quantity: number;
  reserved_quantity: number;
  status: string;
  images: string[];
  package_content?: string;
  attributes?: Record<string, any>;
}

export interface DarazCatalogItem {
  item_id: string;
  title: string;
  category: string;
  brand: string;
  status: string;
  description: string;
  images: string[];
  attributes: Record<string, any>;
  product_url: string;
  skus: DarazProductSku[];
}

export interface DarazProductItem {
  item_id: string;
  seller_sku: string;
  daraz_sku_id?: string;
  title: string;
  category: string;
  brand: string;
  status: string;
  description?: string;
  price_cents: number;
  special_price_cents?: number;
  quantity: number;
  reserved_quantity: number;
  images: string[];
  attributes: Record<string, any>;
  variations: any[];
  product_url?: string;
}

export interface DarazOrderItemDetail {
  order_item_id: string;
  order_id: string;
  name: string;
  product_main_image: string;
  seller_sku: string;
  shop_sku: string;
  quantity: number;
  item_price_cents: number;
  paid_price_cents: number;
  status: string;
  shipment_provider: string;
  tracking_code: string;
  reason?: string;
  raw?: Record<string, any>;
  item_id?: string;
}

export interface DarazOrderItem {
  order_id: string;
  order_number: string;
  package_id: string;
  package_number: string;
  tracking_code: string;
  customer_first_name: string;
  customer_phone: string;
  customer_city: string;
  customer_address: string;
  customer_province: string;
  customer_area: string;
  customer_postcode: string;
  shipping_provider: string;
  shipping_type: string;
  payment_method: string;
  price_cents: number;
  shipping_fee_cents: number;
  voucher_discount_cents: number;
  seller_discount_cents: number;
  statuses: string;
  created_at: string;
  updated_at: string;
  items: DarazOrderItemDetail[];
  raw: Record<string, any>;
}

export interface DarazClientOptions {
  storeId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  appKey?: string;
  appSecret?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Helper to sanitize XML text values
 */
function escapeXml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Translates technical Daraz API error codes into friendly human readable messages
 */
export function humanizeDarazApiError(code: string, rawMessage?: string): string {
  const cleanMsg = rawMessage ? rawMessage.trim() : "";

  switch (code) {
    case "InAuthorized":
    case "IllegalAccessToken":
    case "15":
    case "401":
      return "Your Daraz store connection has expired. Please reconnect your store via My Stores.";
    case "429":
    case "RateLimitExceeded":
    case "RequestLimitExceeded":
    case "Too Many Requests":
      return "Daraz API request limit reached. Please wait a few moments and try again.";
    case "B1001":
    case "InvalidItem":
      return "Daraz Seller Center could not find this product SKU or Item ID.";
    case "B1002":
    case "InvalidStock":
      return "Daraz rejected stock update: Invalid stock quantity or withholding lock active on Seller Center.";
    case "OrderAlreadyPacked":
    case "OrderStateInvalid":
      return "Daraz rejected status update: Order is already packed or in an incompatible status on Seller Center.";
    default:
      return cleanMsg || `Daraz API returned error code [${code}].`;
  }
}

export class DarazApiClient {
  private appKey: string;
  private appSecret: string;
  private baseUrl: string;
  private storeId?: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: DarazClientOptions = {}) {
    this.appKey = (options.appKey || process.env.DARAZ_APP_KEY || "").trim();
    this.appSecret = (options.appSecret || process.env.DARAZ_APP_SECRET || "").trim();
    this.baseUrl = process.env.DARAZ_API_BASE_URL || "https://api.daraz.pk/rest";
    this.storeId = options.storeId;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    if (options.tokenExpiresAt) {
      this.tokenExpiresAt = new Date(options.tokenExpiresAt);
    }
    this.timeoutMs = options.timeoutMs || 15000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Checks if token is expired or expiring within 24 hours, and auto-refreshes if possible.
   */
  private async ensureValidAccessToken(): Promise<string | undefined> {
    if (!this.accessToken) return undefined;

    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const isExpiringSoon = this.tokenExpiresAt && this.tokenExpiresAt.getTime() - Date.now() < twentyFourHoursMs;

    if (isExpiringSoon && this.refreshToken) {
      console.log(`[DarazApiClient] Access token for store ${this.storeId || "unknown"} is expiring within 24h. Refreshing token...`);
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  /**
   * Refreshes access token via Daraz REST API /auth/token/refresh with Supabase atomic mutex lock.
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("Cannot refresh token: missing refresh_token.");
    }

    if (!this.appKey || !this.appSecret) {
      throw new Error("Daraz API Credentials Notice: Missing DARAZ_APP_KEY or DARAZ_APP_SECRET. Reconnect store via My Stores.");
    }

    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    const lockExpiryIso = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    // Atomic DB Mutex Lock to prevent concurrent refresh race conditions
    if (this.storeId) {
      try {
        const { data: lockAcquired, error: lockErr } = await supabase
          .from("daraz_stores")
          .update({ refreshing_token_until: lockExpiryIso, updated_at: nowIso })
          .eq("id", this.storeId)
          .or(`refreshing_token_until.is.null,refreshing_token_until.lt.${nowIso}`)
          .select("id, access_token, refresh_token, token_expires_at");

        if (lockErr || !lockAcquired || lockAcquired.length === 0) {
          console.warn(`[DarazApiClient] Token refresh lock active for store ${this.storeId}. Waiting for concurrent refresh to complete...`);
          await new Promise((r) => setTimeout(r, 2500));
          const { data: latestStore } = await supabase
            .from("daraz_stores")
            .select("access_token, refresh_token, token_expires_at")
            .eq("id", this.storeId)
            .single();

          if (latestStore?.access_token) {
            this.accessToken = latestStore.access_token;
            if (latestStore.refresh_token) this.refreshToken = latestStore.refresh_token;
            if (latestStore.token_expires_at) this.tokenExpiresAt = new Date(latestStore.token_expires_at);
            return;
          }
        }
      } catch (lockEx: any) {
        console.warn("[DarazApiClient] Notice attempting atomic token refresh lock:", lockEx.message);
      }
    }

    try {
      const apiPath = "/auth/token/refresh";
      const timestamp = Date.now().toString();

      const params: Record<string, string> = {
        refresh_token: this.refreshToken,
        app_key: this.appKey,
        timestamp,
        sign_method: "sha256",
      };

      const signature = generateDarazSignature(apiPath, params, this.appSecret);
      params.sign = signature;

      const queryString = new URLSearchParams(params).toString();
      const url = `${this.baseUrl}${apiPath}?${queryString}`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Token refresh failed with HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.code && data.code !== "0") {
        throw new Error(humanizeDarazApiError(data.code, data.message || data.detail));
      }

      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }

      const expiresInSeconds = typeof data.expires_in === "number" ? data.expires_in : parseInt(data.expires_in || "2592000", 10);
      this.tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      if (this.storeId) {
        await supabase
          .from("daraz_stores")
          .update({
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            token_expires_at: this.tokenExpiresAt.toISOString(),
            refreshing_token_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", this.storeId);
      }
    } finally {
      if (this.storeId) {
        try {
          await supabase
            .from("daraz_stores")
            .update({ refreshing_token_until: null })
            .eq("id", this.storeId);
        } catch (_) {}
      }
    }
  }

  /**
   * Sends authenticated API requests with timeout, retries, and rate limit handling.
   */
  private async request<T>(apiPath: string, customParams: Record<string, any> = {}, method: "GET" | "POST" = "GET"): Promise<T> {
    if (!this.appKey || !this.appSecret) {
      throw new Error("Daraz API Credentials Notice: Missing DARAZ_APP_KEY or DARAZ_APP_SECRET. Please configure store API credentials or environment variables.");
    }
    const validToken = await this.ensureValidAccessToken();
    let attempt = 0;

    while (attempt < this.maxRetries) {
      attempt++;
      const timestamp = Date.now().toString();

      const requestParams: Record<string, string> = {
        app_key: this.appKey,
        timestamp,
        sign_method: "sha256",
        ...customParams,
      };

      if (validToken) {
        requestParams.access_token = validToken;
      }

      const signature = generateDarazSignature(apiPath, requestParams, this.appSecret);
      requestParams.sign = signature;

      const queryString = new URLSearchParams(requestParams).toString();
      const url = `${this.baseUrl}${apiPath}?${queryString}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 429 || res.status >= 500) {
          if (attempt < this.maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000;
            console.warn(`[DarazApiClient] HTTP ${res.status} on ${apiPath}. Retrying in ${backoffMs}ms (Attempt ${attempt}/${this.maxRetries})...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
        }

        if (res.status === 401) {
          throw new Error("Daraz connection needs attention: Access token is invalid or store disconnected.");
        }

        if (!res.ok) {
          throw new Error(`Daraz API HTTP Error [${res.status}]: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.code && data.code !== "0") {
          if (data.code === "InAuthorized" || data.code === "IllegalAccessToken" || data.code === "15") {
            if (this.refreshToken && attempt === 1) {
              console.warn("[DarazApiClient] Access token rejected by Daraz API. Attempting refresh token...");
              await this.refreshAccessToken();
              continue;
            }
          }
          if (data.code === "429" || data.code === "RateLimitExceeded" || data.code === "RequestLimitExceeded") {
            if (attempt < this.maxRetries) {
              const backoffMs = Math.pow(2, attempt) * 1500;
              console.warn(`[DarazApiClient] API Rate limit ${data.code} on ${apiPath}. Retrying in ${backoffMs}ms...`);
              await new Promise((r) => setTimeout(r, backoffMs));
              continue;
            }
          }
          const userFriendlyError = humanizeDarazApiError(data.code, data.message || data.detail);
          throw new Error(userFriendlyError);
        }

        return data as T;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === "AbortError") {
          if (attempt < this.maxRetries) {
            console.warn(`[DarazApiClient] Request timeout on ${apiPath}. Retrying (Attempt ${attempt}/${this.maxRetries})...`);
            continue;
          }
          throw new Error(`Daraz API Timeout: Request to ${apiPath} exceeded ${this.timeoutMs}ms limit.`);
        }

        if (attempt >= this.maxRetries) {
          throw err;
        }

        const backoffMs = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw new Error(`Daraz API request failed after ${this.maxRetries} attempts.`);
  }

  /**
   * Fetch Store Seller Profile (/seller/get)
   */
  async getStoreProfile(): Promise<DarazStoreProfile> {
    const response = await this.request<any>("/seller/get");
    const dataObj = response.data || response.result || response || {};
    return {
      seller_id: String(dataObj.seller_id || dataObj.short_code || "SELLER_UNKNOWN"),
      name: dataObj.name || dataObj.short_code || "Daraz Store",
      short_code: dataObj.short_code || "STORE-01",
      email: dataObj.email || "",
      location: dataObj.location || "Pakistan",
    };
  }

  /**
   * Helper to normalize Daraz image URLs into clean HTTPS strings
   */
  private normalizeImageUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    let trimmed = rawUrl.trim();
    if (trimmed.startsWith("//")) {
      trimmed = `https:${trimmed}`;
    } else if (trimmed.startsWith("http://")) {
      trimmed = trimmed.replace("http://", "https://");
    }
    return trimmed;
  }

  /**
   * Safely extract images from a raw images field (supports arrays, objects, and strings)
   */
  private extractImages(rawImages: any): string[] {
    const result: string[] = [];
    if (Array.isArray(rawImages)) {
      rawImages.forEach((img: any) => {
        if (typeof img === "string" && img.trim()) result.push(img.trim());
        else if (img && typeof img === "object") {
          const url = img.url || img.Url || img.image || img.Image || "";
          if (typeof url === "string" && url.trim()) result.push(url.trim());
        }
      });
    } else if (typeof rawImages === "string" && rawImages.trim()) {
      result.push(rawImages.trim());
    }
    return result;
  }

  /**
   * Fetch Store Parent Catalog Items & Nested SKUs (/products/get)
   */
  async getCatalogItems(offset = 0, limit = 50): Promise<{
    items: DarazCatalogItem[];
    total_items: number;
    raw_items_count: number;
    skipped_items: number;
    skipped_skus: number;
  }> {
    const requestTimestamp = new Date().toISOString();
    console.log(
      `[DarazApiClient.getCatalogItems] storeId=${this.storeId || "unknown"} offset=${offset} limit=${limit} requested_at=${requestTimestamp}`
    );

    const response = await this.request<any>("/products/get", {
      filter: "all",
      offset: String(offset),
      limit: String(limit),
    });

    const dataObj = response.data || response.result || response;
    let rawProducts: any[] = [];

    if (Array.isArray(dataObj)) {
      rawProducts = dataObj;
    } else if (Array.isArray(dataObj?.products)) {
      rawProducts = dataObj.products;
    } else if (Array.isArray(dataObj?.products?.product)) {
      rawProducts = dataObj.products.product;
    } else if (Array.isArray(dataObj?.Products)) {
      rawProducts = dataObj.Products;
    } else if (Array.isArray(dataObj?.Products?.Product)) {
      rawProducts = dataObj.Products.Product;
    } else if (Array.isArray(dataObj?.product)) {
      rawProducts = dataObj.product;
    }

    const total_items = parseInt(
      String(
        dataObj?.total_products ??
        dataObj?.total ??
        dataObj?.TotalProducts ??
        dataObj?.Total ??
        rawProducts.length
      ),
      10
    ) || rawProducts.length;

    const raw_items_count = rawProducts.length;
    const items: DarazCatalogItem[] = [];
    let skipped_items = 0;
    let skipped_skus = 0;

    rawProducts.forEach((p, pIdx) => {
      const rawItemId = p.item_id || p.ItemId || p.itemId || "";
      const itemId = typeof rawItemId === "string" ? rawItemId.trim() : String(rawItemId || "").trim();

      if (!itemId) {
        skipped_items++;
        return;
      }

      const rawAttributes: Record<string, any> = p.attributes || p.Attributes || {};
      const productLevelImages: string[] = [];
      const rawProductImages = p.images || p.Images || [];
      productLevelImages.push(...this.extractImages(rawProductImages));

      if (rawAttributes.images) productLevelImages.push(...this.extractImages(rawAttributes.images));
      else if (rawAttributes.image) productLevelImages.push(...this.extractImages(rawAttributes.image));

      const description =
        rawAttributes.description ||
        rawAttributes.Description ||
        rawAttributes.short_description ||
        rawAttributes.ShortDescription ||
        p.description ||
        p.Description ||
        "";

      const skuCollection = p.skus || p.Skus || [];
      const rawSkus: any[] = Array.isArray(skuCollection) && skuCollection.length > 0 ? skuCollection : [{}];
      const parsedSkus: DarazProductSku[] = [];

      rawSkus.forEach((sku: any, sIdx: number) => {
        const rawSellerSku =
          sku.SellerSku || sku.seller_sku || sku.sellerSku || sku.SellerSKU || "";
        const sellerSku = typeof rawSellerSku === "string" ? rawSellerSku.trim() : String(rawSellerSku || "").trim();

        if (!sellerSku) {
          skipped_skus++;
          return;
        }

        const skuImages: string[] = [...productLevelImages];
        const rawSkuImages = sku.Images || sku.images || [];
        skuImages.push(...this.extractImages(rawSkuImages));

        const normalizedImages = Array.from(
          new Set(skuImages.map((url) => this.normalizeImageUrl(url)).filter(Boolean))
        );

        const rawQty =
          sku.quantity ??
          sku.Quantity ??
          sku.Available ??
          sku.available ??
          sku.stock ??
          sku.Stock ??
          0;
        const parsedQuantity = Math.max(0, parseInt(String(rawQty), 10) || 0);

        const rawReserved =
          sku.withholding_quantity ??
          sku.WithholdingQuantity ??
          sku.reserved_stock ??
          sku.ReservedStock ??
          sku.reserved_quantity ??
          sku.ReservedQuantity ??
          0;
        const parsedReserved = Math.max(0, parseInt(String(rawReserved), 10) || 0);

        const rawPrice = sku.price ?? sku.Price ?? sku.SalePrice ?? sku.sale_price ?? 0;
        const priceCents = Math.round((parseFloat(String(rawPrice)) || 0) * 100);

        const specialPrice = sku.special_price ?? sku.SpecialPrice ?? sku.SalePrice ?? sku.sale_price;
        const specialPriceCents =
          specialPrice !== null && specialPrice !== undefined && specialPrice !== rawPrice
            ? Math.round(parseFloat(String(specialPrice)) * 100) || undefined
            : undefined;

        const darazSkuId = String(
          sku.SkuId || sku.skuId || sku.sku_id || sku.SkuID || sku.ShopSku || ""
        );
        const shopSku = String(
          sku.ShopSku || sku.shop_sku || sku.ShopSKU || sku.SkuId || sku.sku_id || ""
        );

        const skuStatus = String(
          sku.Status || sku.status || p.status || p.Status || "active"
        ).toLowerCase();

        parsedSkus.push({
          seller_sku: sellerSku,
          daraz_sku_id: darazSkuId,
          shop_sku: shopSku,
          item_id: itemId,
          price_cents: priceCents,
          special_price_cents: specialPriceCents,
          quantity: parsedQuantity,
          reserved_quantity: parsedReserved,
          status: skuStatus,
          images: normalizedImages,
          package_content: sku.package_content || sku.PackageContent || "",
          attributes: sku,
        });
      });

      if (parsedSkus.length === 0) {
        skipped_items++;
        return;
      }

      const parentImages = Array.from(
        new Set(productLevelImages.map((url) => this.normalizeImageUrl(url)).filter(Boolean))
      );

      const title =
        rawAttributes.name_en ||
        rawAttributes.NameEn ||
        rawAttributes.name ||
        rawAttributes.Name ||
        p.title ||
        p.Title ||
        p.name ||
        p.Name ||
        "";

      items.push({
        item_id: itemId,
        title,
        category: String(
          p.primary_category || p.PrimaryCategory ||
          rawAttributes.category || rawAttributes.Category ||
          "General"
        ),
        brand: String(rawAttributes.brand || rawAttributes.Brand || "Generic"),
        status: String(p.status || p.Status || "active").toLowerCase(),
        description,
        images: parentImages,
        attributes: rawAttributes,
        product_url:
          p.url || p.Url || p.product_url || p.ProductUrl ||
          rawAttributes.product_url || rawAttributes.ProductUrl ||
          "",
        skus: parsedSkus,
      });
    });

    return { items, total_items, raw_items_count, skipped_items, skipped_skus };
  }

  /**
   * Update Price and Quantity on Daraz Seller Center (/product/price_quantity/update)
   * Enforces strict XML payload format and 20 SKU batching per request.
   */
  async updatePriceAndQuantity(skuUpdates: Array<{
    sellerSku: string;
    itemId?: string;
    skuId?: string;
    priceCents?: number;
    specialPriceCents?: number;
    quantity?: number;
  }>): Promise<boolean> {
    if (!skuUpdates || skuUpdates.length === 0) return true;

    // Batching: Chunk updates into max 20 SKUs per request
    const BATCH_SIZE = 20;
    const batches: typeof skuUpdates[] = [];
    for (let i = 0; i < skuUpdates.length; i += BATCH_SIZE) {
      batches.push(skuUpdates.slice(i, i + BATCH_SIZE));
    }

    let allSuccessful = true;

    for (const batch of batches) {
      let xmlSkus = "";
      for (const item of batch) {
        let skuXml = `<Sku><SellerSku>${escapeXml(item.sellerSku)}</SellerSku>`;
        if (item.itemId) {
          skuXml += `<ItemId>${escapeXml(item.itemId)}</ItemId>`;
        }
        if (item.skuId) {
          skuXml += `<SkuId>${escapeXml(item.skuId)}</SkuId>`;
        }
        if (typeof item.quantity === "number") {
          skuXml += `<Quantity>${item.quantity}</Quantity>`;
        }
        if (typeof item.priceCents === "number") {
          skuXml += `<Price>${(item.priceCents / 100).toFixed(2)}</Price>`;
        }
        if (typeof item.specialPriceCents === "number") {
          skuXml += `<SalePrice>${(item.specialPriceCents / 100).toFixed(2)}</SalePrice>`;
        }
        skuXml += `</Sku>`;
        xmlSkus += skuXml;
      }

      const payload = `<Request><Product><Skus>${xmlSkus}</Skus></Product></Request>`;

      try {
        const response = await this.request<{ code: string; message?: string }>("/product/price_quantity/update", {
          payload,
        }, "POST");

        if (response.code && response.code !== "0") {
          allSuccessful = false;
          console.error(`[DarazApiClient] updatePriceAndQuantity batch failed code=${response.code}:`, response.message);
        }
      } catch (err: any) {
        allSuccessful = false;
        console.error("[DarazApiClient] updatePriceAndQuantity batch exception:", err.message);
      }
    }

    return allSuccessful;
  }

  /**
   * Update Product Attributes and Images on Daraz Seller Center (/product/update)
   */
  async updateProduct(itemId: string, sku: string, attributes: Record<string, any>, images?: string[]): Promise<boolean> {
    const skuObj: Record<string, any> = {
      SellerSku: sku,
    };

    if (Array.isArray(images) && images.length > 0) {
      skuObj.Images = {
        Image: images,
      };
    }

    const payload = JSON.stringify({
      Request: {
        Product: {
          ItemId: itemId,
          Attributes: attributes,
          Skus: {
            Sku: [skuObj],
          },
        },
      },
    });

    const response = await this.request<{ code: string; message?: string }>("/product/update", {
      payload,
    }, "POST");

    return !response.code || response.code === "0";
  }

  /**
   * Fetch Itemized Order Details (/order/items/get)
   */
  async getOrderItems(orderId: string): Promise<DarazOrderItemDetail[]> {
    try {
      const response = await this.request<any>("/order/items/get", { order_id: orderId });
      const dataObj = response.data || response.result || response;
      let rawItems: any[] = [];

      if (Array.isArray(dataObj)) {
        rawItems = dataObj;
      } else if (Array.isArray(dataObj?.order_items)) {
        rawItems = dataObj.order_items;
      } else if (Array.isArray(dataObj?.order_items?.order_item)) {
        rawItems = dataObj.order_items.order_item;
      } else if (Array.isArray(dataObj?.items)) {
        rawItems = dataObj.items;
      }

      return rawItems.map((item) => ({
        order_item_id: String(item.order_item_id || item.item_id),
        item_id: String(item.order_item_id || item.item_id || ""),
        order_id: String(item.order_id || orderId),
        name: item.name || "",
        product_main_image: item.product_main_image || "",
        seller_sku: item.sku || item.seller_sku || "",
        shop_sku: item.shop_sku || item.daraz_sku || "",
        quantity: Math.max(1, parseInt(String(item.quantity || 1), 10) || 1),
        item_price_cents: Math.round((parseFloat(String(item.item_price || 0)) || 0) * 100),
        paid_price_cents: Math.round((parseFloat(String(item.paid_price || item.item_price || 0)) || 0) * 100),
        status: String(item.status || "pending").toLowerCase(),
        shipment_provider: item.shipment_provider || "Daraz Express",
        tracking_code: item.tracking_code || "",
        reason: item.reason || "",
        raw: item,
      }));
    } catch (err: any) {
      console.error(`[DarazApiClient] getOrderItems error for Order ${orderId}:`, err.message);
      throw new Error(`Failed to fetch order items for Order #${orderId}: ${err.message}`);
    }
  }

  /**
   * Fetch Single Order Details (/order/get)
   */
  async getOrderDetails(orderId: string): Promise<Record<string, any>> {
    try {
      const response = await this.request<any>("/order/get", { order_id: orderId });
      const dataObj = response.data || response.result || response;
      return dataObj?.order || dataObj;
    } catch (err: any) {
      console.error(`[DarazApiClient] getOrderDetails error for Order ${orderId}:`, err.message);
      throw new Error(`Failed to fetch order details for Order #${orderId}: ${err.message}`);
    }
  }

  /**
   * Fetch Eligible Shipment Providers (/shipment/providers/get)
   */
  async getShipmentProviders(): Promise<Array<{ name: string; is_default?: boolean }>> {
    try {
      const response = await this.request<any>("/shipment/providers/get");
      const dataObj = response.data || response.result || response;
      let rawProviders: any[] = [];

      if (Array.isArray(dataObj)) {
        rawProviders = dataObj;
      } else if (Array.isArray(dataObj?.shipment_providers)) {
        rawProviders = dataObj.shipment_providers;
      } else if (Array.isArray(dataObj?.providers)) {
        rawProviders = dataObj.providers;
      }

      return rawProviders.map((p) => ({
        name: typeof p === "string" ? p : p.name || p.provider_name || "Daraz Express (DEX)",
        is_default: typeof p === "object" ? Boolean(p.is_default || p.default) : false,
      }));
    } catch (err: any) {
      console.warn("[DarazApiClient] getShipmentProviders notice:", err.message);
      return [{ name: "Daraz Express (DEX)", is_default: true }];
    }
  }

  /**
   * Verified Daraz Store Connectivity Check
   */
  async verifyStoreConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.storeId) {
      return { success: false, error: "Missing storeId for connection verification." };
    }

    const supabase = createAdminClient();
    const timestamp = new Date().toISOString();

    try {
      await this.request<any>("/seller/get");

      await supabase
        .from("daraz_stores")
        .update({
          sync_status: "connected",
          is_active: true,
          last_sync_error: null,
          last_synced_at: timestamp,
          updated_at: timestamp,
        })
        .eq("id", this.storeId);

      return { success: true };
    } catch (err: any) {
      const errorMsg = humanizeDarazApiError(err.code || "AUTH_FAILED", err.message);

      await supabase
        .from("daraz_stores")
        .update({
          sync_status: "disconnected",
          last_sync_error: errorMsg,
          updated_at: timestamp,
        })
        .eq("id", this.storeId);

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Fetch Store Orders with Multi-Format Response Parsing (/orders/get)
   */
  async getOrders(offset = 0, limit = 100, updateAfter?: string): Promise<{ orders: DarazOrderItem[]; total: number }> {
    const safeUpdateAfter = updateAfter || "2020-01-01T00:00:00Z";

    const params: Record<string, string> = {
      sort_by: "created_at",
      sort_direction: "DESC",
      offset: String(offset),
      limit: String(limit),
      update_after: safeUpdateAfter,
    };

    const response = await this.request<any>("/orders/get", params);
    const dataObj = response.data || response.result || response;
    let rawOrders: any[] = [];

    if (Array.isArray(dataObj)) {
      rawOrders = dataObj;
    } else if (Array.isArray(dataObj?.orders)) {
      rawOrders = dataObj.orders;
    } else if (Array.isArray(dataObj?.orders?.order)) {
      rawOrders = dataObj.orders.order;
    } else if (Array.isArray(dataObj?.order)) {
      rawOrders = dataObj.order;
    }

    const total = dataObj?.countTotal ?? dataObj?.count ?? rawOrders.length;

    const orders: DarazOrderItem[] = rawOrders.map((o) => {
      const addressShipping = o.address_shipping || {};
      const addressBilling = o.address_billing || {};

      let rawStatus = "pending";
      if (Array.isArray(o.statuses) && o.statuses.length > 0) {
        rawStatus = String(o.statuses[0]);
      } else if (typeof o.statuses === "string" && o.statuses.trim()) {
        rawStatus = o.statuses.trim();
      } else if (typeof o.status === "string" && o.status.trim()) {
        rawStatus = o.status.trim();
      }

      const normalizedStatus = rawStatus.toLowerCase().replace(/[-\s]+/g, "_");

      const exactFirstName = o.customer_first_name || addressShipping.first_name || addressBilling.first_name || "Customer";
      const exactLastName = o.customer_last_name || addressShipping.last_name || addressBilling.last_name || "";
      const exactFullName = `${exactFirstName} ${exactLastName}`.trim();

      const exactPhone = addressShipping.phone || addressBilling.phone || o.customer_phone || "N/A";
      const exactCity = addressShipping.city || addressBilling.city || "Karachi";
      const exactAddress = [addressShipping.address1, addressShipping.address2].filter(Boolean).join(", ").trim() || "Address on File";

      const exactProvince = addressShipping.address3 || addressShipping.state || o.customer_province || "";
      const exactArea = addressShipping.address5 || addressShipping.address4 || o.customer_area || "";
      const exactPostcode = addressShipping.postCode || addressShipping.post_code || o.customer_postcode || "";

      return {
        order_id: String(o.order_id || o.orderId || ""),
        order_number: String(o.order_number || o.orderNumber || o.order_id || ""),
        package_id: String(o.package_id || o.packageId || ""),
        package_number: String(o.package_number || ""),
        tracking_code: String(o.tracking_code || ""),
        customer_first_name: exactFirstName,
        customer_phone: exactPhone,
        customer_city: exactCity,
        customer_address: exactAddress,
        customer_province: exactProvince,
        customer_area: exactArea,
        customer_postcode: exactPostcode,
        shipping_provider: String(o.shipping_provider || o.shipment_provider_type || ""),
        shipping_type: String(o.shipping_type || ""),
        payment_method: String(o.payment_method || ""),
        price_cents: Math.round((parseFloat(String(o.price || 0)) || 0) * 100),
        shipping_fee_cents: Math.round((parseFloat(String(o.shipping_fee || 0)) || 0) * 100),
        voucher_discount_cents: Math.round((parseFloat(String(o.voucher_discount || 0)) || 0) * 100),
        seller_discount_cents: Math.round((parseFloat(String(o.seller_discount || 0)) || 0) * 100),
        statuses: normalizedStatus,
        created_at: String(o.created_at || o.date_created || ""),
        updated_at: String(o.updated_at || o.date_updated || ""),
        items: [],
        raw: o,
      };
    });

    return { orders, total };
  }

  /**
   * Cancel order items on Daraz Seller Center (/order/cancel)
   */
  async cancelOrder(itemIds: string[]): Promise<{ success: boolean }> {
    try {
      const response = await this.request<any>("/order/cancel", {
        reason_id: "22",
        reason_detail: "",
        order_item_ids: JSON.stringify(itemIds),
      }, "POST");

      const isSuccess = !response.code || response.code === "0";
      return { success: isSuccess };
    } catch (err: any) {
      throw new Error(`cancelOrder failed: ${err.message}`);
    }
  }

  /**
   * Pack an order on Daraz Seller Center (/order/fulfill/pack or /order/pack)
   * Passes order_item_list as array of order_item_id strings and delivery_type: "dropship".
   */
  async packOrder(itemIds: string[], shippingProvider: string): Promise<{ success: boolean; packageId?: string }> {
    try {
      const orderItemListStr = JSON.stringify(itemIds);
      const params: Record<string, string> = {
        order_item_list: orderItemListStr,
        item_ids: orderItemListStr,
        delivery_type: "dropship",
        shipping_provider: shippingProvider || "Daraz Express (DEX)",
      };

      let response: any;
      try {
        response = await this.request<any>("/order/fulfill/pack", params, "POST");
      } catch (_) {
        response = await this.request<any>("/order/pack", params, "POST");
      }

      const dataObj = response?.data || response?.result || response || {};
      let packageId: string | undefined = undefined;

      if (Array.isArray(dataObj?.packages) && dataObj.packages.length > 0) {
        packageId = String(dataObj.packages[0].package_id || dataObj.packages[0].packageId || "");
      } else if (dataObj?.package_id || dataObj?.packageId) {
        packageId = String(dataObj.package_id || dataObj.packageId);
      }

      const isSuccess = !response.code || response.code === "0";
      return { success: isSuccess, packageId: packageId || undefined };
    } catch (err: any) {
      throw new Error(`packOrder failed: ${err.message}`);
    }
  }

  /**
   * Set order items or package as Ready To Ship (/order/package/rts or /order/fulfill/readyToShip)
   */
  async setReadyToShip(
    itemIds: string[],
    trackingNumber: string,
    shippingProvider: string,
    packageId?: string
  ): Promise<{ success: boolean }> {
    try {
      const orderItemListStr = JSON.stringify(itemIds);
      const params: Record<string, string> = {
        order_item_ids: orderItemListStr,
        item_ids: orderItemListStr,
        delivery_type: "dropship",
        shipping_provider: shippingProvider || "Daraz Express (DEX)",
        tracking_number: trackingNumber || "",
      };

      if (packageId) {
        params.package_id = packageId;
        params.package_id_list = JSON.stringify([packageId]);
      }

      let response: any;
      try {
        response = await this.request<any>("/order/package/rts", params, "POST");
      } catch (_) {
        response = await this.request<any>("/order/fulfill/readyToShip", params, "POST");
      }

      const isSuccess = !response.code || response.code === "0";
      return { success: isSuccess };
    } catch (err: any) {
      throw new Error(`setReadyToShip failed: ${err.message}`);
    }
  }

  /**
   * Retrieve official Daraz shipping document (label/invoice/manifest) for order items or package.
   * Calls /order/document/get with doc_type: "shippingLabel" and returns base64 content.
   */
  async getShippingDocument(
    itemIds: string[],
    docType: "shippingLabel" | "invoice" | "carrierManifest" | string = "shippingLabel",
    packageId?: string
  ): Promise<{ file: string; mimeType: string; raw: any }> {
    const params: Record<string, string> = {
      doc_type: docType,
      order_item_ids: JSON.stringify(itemIds),
    };

    if (packageId) {
      params.package_id = packageId;
    }

    let response: any;
    try {
      response = await this.request<any>("/order/document/get", params);
    } catch (err: any) {
      // Fallback endpoint shape if needed
      response = await this.request<any>("/doc/shipping/get", { doc_type: docType, order_id: itemIds[0] });
    }

    const dataObj = response.data || response.result || response;

    const fileContent =
      dataObj?.document?.file ||
      dataObj?.document ||
      dataObj?.file ||
      dataObj?.pdf ||
      dataObj?.content ||
      dataObj?.file_content ||
      "";

    const mimeType =
      dataObj?.document?.mime_type ||
      dataObj?.mime_type ||
      dataObj?.mimeType ||
      "application/pdf";

    return { file: fileContent, mimeType, raw: dataObj };
  }
}

/**
 * Factory: Creates a DarazApiClient pre-populated from a store's credentials in Supabase.
 */
export async function getDarazClient(storeId: string): Promise<DarazApiClient> {
  const supabase = createAdminClient();

  const { data: store, error } = await supabase
    .from("daraz_stores")
    .select("id, access_token, refresh_token, token_expires_at, api_app_key, api_app_secret")
    .eq("id", storeId)
    .single();

  if (error || !store) {
    throw new Error(`Store ${storeId} not found in database: ${error?.message || "unknown"}`);
  }

  if (!store.access_token) {
    throw new Error(`Store ${storeId} has no active access token. Reconnect via My Stores.`);
  }

  return new DarazApiClient({
    storeId: store.id,
    accessToken: store.access_token,
    refreshToken: store.refresh_token || undefined,
    tokenExpiresAt: store.token_expires_at || undefined,
    appKey: store.api_app_key || undefined,
    appSecret: store.api_app_secret || undefined,
  });
}

/**
 * Sanitize log payloads to remove sensitive credentials before storing to database
 */
export function sanitizeLogPayload(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;

  const SENSITIVE_KEYS = [
    "access_token", "refresh_token", "token", "api_key", "app_key",
    "app_secret", "api_app_key", "api_app_secret", "secret", "password",
    "authorization", "auth_token",
  ];

  try {
    const sanitized = { ...payload };
    for (const key of SENSITIVE_KEYS) {
      if (sanitized[key]) {
        sanitized[key] = "[REDACTED]";
      }
    }
    return sanitized;
  } catch (e) {
    return { sanitized: true };
  }
}
