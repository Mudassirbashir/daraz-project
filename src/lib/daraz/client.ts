import { generateDarazSignature } from "./signature";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DarazStoreProfile {
  seller_id: string;
  name: string;
  short_code: string;
  email: string;
  location: string;
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
  item_price_cents: number;
  paid_price_cents: number;
  status: string;
  shipment_provider: string;
  tracking_code: string;
  reason?: string;
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
  timeoutMs?: number;
  maxRetries?: number;
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
    const key = process.env.DARAZ_APP_KEY;
    if (!key || !key.trim()) {
      throw new Error("[DarazApiClient Error]: DARAZ_APP_KEY environment variable is required.");
    }
    this.appKey = key.trim();

    const secret = process.env.DARAZ_APP_SECRET;
    if (!secret || !secret.trim()) {
      throw new Error("[DarazApiClient Error]: DARAZ_APP_SECRET environment variable is required.");
    }
    this.appSecret = secret.trim();

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
   * Checks if token is expired or expiring within 5 minutes, and auto-refreshes if possible.
   */
  private async ensureValidAccessToken(): Promise<string | undefined> {
    if (!this.accessToken) return undefined;

    const fiveMinutesMs = 5 * 60 * 1000;
    const isExpiringSoon = this.tokenExpiresAt && this.tokenExpiresAt.getTime() - Date.now() < fiveMinutesMs;

    if (isExpiringSoon && this.refreshToken) {
      console.log(`[DarazApiClient] Access token for store ${this.storeId || "unknown"} is expiring soon. Refreshing token...`);
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  /**
   * Refreshes access token via Daraz REST API /auth/token/refresh and updates database.
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error("Cannot refresh token: missing refresh_token.");
    }

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
      throw new Error(`Token refresh API error [${data.code}]: ${data.message || data.detail}`);
    }

    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    const expiresInSeconds = typeof data.expires_in === "number" ? data.expires_in : parseInt(data.expires_in || "2592000", 10);
    this.tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    if (this.storeId) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from("daraz_stores")
          .update({
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
            token_expires_at: this.tokenExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", this.storeId);
      } catch (dbErr: any) {
        console.error("[DarazApiClient] Failed to persist refreshed token to database:", dbErr.message);
      }
    }
  }

  /**
   * Sends authenticated API requests with timeout, retries, and rate limit handling.
   */
  private async request<T>(apiPath: string, customParams: Record<string, any> = {}): Promise<T> {
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
          method: "GET",
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
          throw new Error(`Daraz Unauthorized [401]: Store access token invalid or store disconnected.`);
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
          throw new Error(`Daraz API Exception [${data.code}]: ${data.message || data.detail || "API Call Failed"}`);
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
    const response = await this.request<{ data: any }>("/seller/get");
    const data = response.data || {};
    return {
      seller_id: String(data.seller_id || data.short_code || "SELLER_UNKNOWN"),
      name: data.name || data.short_code || "Daraz Store",
      short_code: data.short_code || "STORE-01",
      email: data.email || "",
      location: data.location || "Pakistan",
    };
  }

  /**
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
   * Fetch Store Products with Pagination & Normalized Fields (/products/get)
   */
  async getProducts(offset = 0, limit = 50): Promise<{ products: DarazProductItem[]; total: number }> {
    const response = await this.request<{ data: { products?: any[]; total_products?: number } }>("/products/get", {
      filter: "all",
      offset: String(offset),
      limit: String(limit),
    });

    const rawProducts = response.data?.products || [];
    const total = response.data?.total_products || rawProducts.length;

    const products: DarazProductItem[] = rawProducts.map((p) => {
      const firstSku = p.skus?.[0] || {};
      const rawAttributes = p.attributes || {};

      // Normalize images from all possible Daraz API response locations
      const imageCandidates: string[] = [];

      if (Array.isArray(p.images)) {
        p.images.forEach((img: any) => {
          if (typeof img === "string") imageCandidates.push(img);
        });
      }

      if (Array.isArray(p.skus)) {
        p.skus.forEach((sku: any) => {
          if (Array.isArray(sku.Images)) {
            sku.Images.forEach((img: any) => {
              if (typeof img === "string") imageCandidates.push(img);
            });
          } else if (typeof sku.Images === "string") {
            imageCandidates.push(sku.Images);
          }
          if (Array.isArray(sku.images)) {
            sku.images.forEach((img: any) => {
              if (typeof img === "string") imageCandidates.push(img);
            });
          }
        });
      }

      if (Array.isArray(rawAttributes.images)) {
        rawAttributes.images.forEach((img: any) => {
          if (typeof img === "string") imageCandidates.push(img);
        });
      } else if (typeof rawAttributes.image === "string") {
        imageCandidates.push(rawAttributes.image);
      }

      // Deduplicate and convert to HTTPS
      const normalizedImages = Array.from(
        new Set(imageCandidates.map((url) => this.normalizeImageUrl(url)).filter(Boolean))
      );

      const description =
        rawAttributes.description ||
        rawAttributes.short_description ||
        p.description ||
        "No description provided.";

      const variations = Array.isArray(p.skus)
        ? p.skus.map((sku: any) => ({
            seller_sku: sku.SellerSku || "",
            shop_sku: sku.ShopSku || "",
            sku_id: String(sku.SkuId || ""),
            price_cents: Math.round((sku.price || 0) * 100),
            special_price_cents: sku.special_price ? Math.round(sku.special_price * 100) : undefined,
            quantity: sku.quantity || 0,
            reserved_quantity: sku.withholding_quantity || sku.reserved_stock || 0,
            package_content: sku.package_content || "",
            package_weight: sku.package_weight || "",
            images: Array.isArray(sku.Images)
              ? sku.Images.map((img: string) => this.normalizeImageUrl(img))
              : typeof sku.Images === "string"
              ? [this.normalizeImageUrl(sku.Images)]
              : [],
          }))
        : [];

      return {
        item_id: String(p.item_id || firstSku.ShopSku || `ITEM_${Date.now()}`),
        seller_sku: firstSku.SellerSku || `SKU_${p.item_id}`,
        daraz_sku_id: String(firstSku.SkuId || firstSku.ShopSku || ""),
        title: rawAttributes.name || firstSku.package_content || p.title || "Daraz Product",
        category: String(p.primary_category || rawAttributes.category || "General"),
        brand: String(rawAttributes.brand || "Generic"),
        status: String(p.status || "active").toLowerCase(),
        description,
        price_cents: Math.round((firstSku.price || 0) * 100),
        special_price_cents: firstSku.special_price ? Math.round(firstSku.special_price * 100) : undefined,
        quantity: firstSku.quantity || 0,
        reserved_quantity: firstSku.withholding_quantity || firstSku.reserved_stock || 0,
        images: normalizedImages,
        attributes: rawAttributes,
        variations,
        product_url: p.url || p.product_url || rawAttributes.product_url || "",
      };
    });

    return { products, total };
  }

  /**
   * Update Price and Quantity on Daraz Seller Center (/product/price_quantity/update)
   */
  async updatePriceAndQuantity(skuUpdates: Array<{
    sellerSku: string;
    itemId?: string;
    priceCents?: number;
    specialPriceCents?: number;
    quantity?: number;
  }>): Promise<boolean> {
    const skuPayloads = skuUpdates.map((item) => {
      const skuObj: Record<string, any> = {
        SellerSku: item.sellerSku,
      };
      if (typeof item.priceCents === "number") {
        skuObj.Price = (item.priceCents / 100).toFixed(2);
      }
      if (typeof item.specialPriceCents === "number") {
        skuObj.SalePrice = (item.specialPriceCents / 100).toFixed(2);
      }
      if (typeof item.quantity === "number") {
        skuObj.Quantity = item.quantity;
      }
      return skuObj;
    });

    const payload = JSON.stringify({
      Request: {
        Product: {
          Skus: {
            Sku: skuPayloads,
          },
        },
      },
    });

    const response = await this.request<{ code: string; message?: string }>("/product/price_quantity/update", {
      payload,
    });

    return !response.code || response.code === "0";
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
    });

    return !response.code || response.code === "0";
  }

  /**
   * Fetch Itemized Order Details (/order/items/get)
   */
  async getOrderItems(orderId: string): Promise<DarazOrderItemDetail[]> {
    try {
      const response = await this.request<{ data?: any[] }>("/order/items/get", { order_id: orderId });
      const rawItems = response.data || [];

      return rawItems.map((item) => ({
        order_item_id: String(item.order_item_id || item.item_id),
        order_id: String(item.order_id || orderId),
        name: item.name || "Daraz Product",
        product_main_image: item.product_main_image || "",
        seller_sku: item.sku || item.seller_sku || "SKU_UNKNOWN",
        shop_sku: item.shop_sku || item.daraz_sku || "",
        item_price_cents: Math.round((item.item_price || 0) * 100),
        paid_price_cents: Math.round((item.paid_price || item.item_price || 0) * 100),
        status: String(item.status || "pending").toLowerCase(),
        shipment_provider: item.shipment_provider || "Daraz Express",
        tracking_code: item.tracking_code || "",
        reason: item.reason || "",
      }));
    } catch (err: any) {
      console.warn(`[DarazApiClient] getOrderItems notice for Order ${orderId}:`, err.message);
      return [];
    }
  }

  /**
   * Fetch Store Orders with Pagination & Full Normalized Header Fields (/orders/get)
   */
  async getOrders(offset = 0, limit = 50, createdAfter?: string): Promise<{ orders: DarazOrderItem[]; total: number }> {
    const params: Record<string, string> = {
      sort_by: "created_at",
      sort_direction: "DESC",
      offset: String(offset),
      limit: String(limit),
    };

    if (createdAfter) {
      params.created_after = createdAfter;
    }

    const response = await this.request<{ data: { orders?: any[]; countTotal?: number } }>("/orders/get", params);

    const rawOrders = response.data?.orders || [];
    const total = response.data?.countTotal || rawOrders.length;

    const orders: DarazOrderItem[] = rawOrders.map((o) => {
      const addressShipping = o.address_shipping || {};
      const addressBilling = o.address_billing || {};

      return {
        order_id: String(o.order_id),
        order_number: String(o.order_number || o.order_id),
        package_id: String(o.package_id || `PKG-${o.order_id}`),
        package_number: String(o.package_number || o.order_id),
        tracking_code: o.statuses?.[0] || o.tracking_code || o.order_number || `DEX-${o.order_id}`,
        customer_first_name: `${o.customer_first_name || "Customer"} ${o.customer_last_name || ""}`.trim(),
        customer_phone: addressShipping.phone || addressBilling.phone || "N/A",
        customer_city: addressShipping.city || addressBilling.city || "Pakistan",
        customer_address: `${addressShipping.address1 || ""} ${addressShipping.address2 || ""}`.trim() || "Address on File",
        customer_province: addressShipping.address3 || addressShipping.state || "Pakistan",
        customer_area: addressShipping.address4 || addressShipping.city || "",
        customer_postcode: addressShipping.postcode || "",
        shipping_provider: o.shipping_provider || addressShipping.shipping_provider || "Daraz Express (DEX)",
        shipping_type: o.shipping_type || "Standard",
        payment_method: o.payment_method || "COD",
        price_cents: Math.round((o.price || 0) * 100),
        shipping_fee_cents: Math.round((o.shipping_fee || 0) * 100),
        voucher_discount_cents: Math.round((o.voucher_platform || 0) * 100),
        seller_discount_cents: Math.round((o.voucher_seller || 0) * 100),
        statuses: (o.statuses?.[0] || "pending").toLowerCase(),
        created_at: o.created_at || new Date().toISOString(),
        updated_at: o.updated_at || new Date().toISOString(),
        items: [],
        raw: o,
      };
    });

    return { orders, total };
  }

  /**
   * Fetch Official Original Shipping Label Document (/order/document/get)
   */
  async getShippingDocument(
    orderItemIds: string[],
    docType: "shipping_label" | "invoice" | "carrierManifest" = "shipping_label"
  ): Promise<{ file: string; mimeType: string }> {
    const formattedItemIds = JSON.stringify(orderItemIds.map((id) => parseInt(id, 10) || id));

    const response = await this.request<{
      data?: {
        document?: {
          file?: string;
          mime_type?: string;
          document_type?: string;
        };
      };
    }>("/order/document/get", {
      doc_type: docType,
      order_item_ids: formattedItemIds,
    });

    const doc = response.data?.document;
    if (!doc || !doc.file) {
      throw new Error(`Daraz API returned empty shipping document for items [${orderItemIds.join(", ")}].`);
    }

    return {
      file: doc.file,
      mimeType: doc.mime_type || "text/html",
    };
  }
}
