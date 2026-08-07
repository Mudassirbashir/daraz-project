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
  status: string;
  price_cents: number;
  special_price_cents?: number;
  quantity: number;
  images?: string[];
}

export interface DarazOrderItem {
  order_id: string;
  tracking_code: string;
  customer_first_name: string;
  customer_city: string;
  price_cents: number;
  statuses: string;
  created_at: string;
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
    this.appKey = process.env.DARAZ_APP_KEY || "504904";
    this.appSecret = process.env.DARAZ_APP_SECRET || "";
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
   * Fetch Store Products with Pagination (/products/get)
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
      const imagesList = p.images || (firstSku.Images ? [firstSku.Images] : []);
      return {
        item_id: String(p.item_id || firstSku.ShopSku || `ITEM_${Date.now()}`),
        seller_sku: firstSku.SellerSku || `SKU_${p.item_id}`,
        daraz_sku_id: String(firstSku.SkuId || firstSku.ShopSku || ""),
        title: p.attributes?.name || firstSku.package_content || "Daraz Product",
        status: (p.status || "active").toLowerCase(),
        price_cents: Math.round((firstSku.price || 0) * 100),
        special_price_cents: firstSku.special_price ? Math.round(firstSku.special_price * 100) : undefined,
        quantity: firstSku.quantity || 0,
        images: Array.isArray(imagesList) ? imagesList : [imagesList],
      };
    });

    return { products, total };
  }

  /**
   * Fetch Store Orders with Pagination (/orders/get)
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

    const orders: DarazOrderItem[] = rawOrders.map((o) => ({
      order_id: String(o.order_id),
      tracking_code: o.statuses?.[0] || o.order_number || `DEX-${o.order_id}`,
      customer_first_name: o.customer_first_name || "Customer",
      customer_city: o.address_shipping?.city || "Pakistan",
      price_cents: Math.round((o.price || 0) * 100),
      statuses: (o.statuses?.[0] || "pending").toLowerCase(),
      created_at: o.created_at || new Date().toISOString(),
    }));

    return { orders, total };
  }
}
