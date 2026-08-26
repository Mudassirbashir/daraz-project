import { signDarazRequest, DarazSignParams, normalizeApiPath } from './signature';
import { createAdminClient } from '../supabase/admin';
import { globalDarazRateLimiter, DarazRateLimiter } from './rate-limiter';

// Endpoint-specific rate limits (requests per second)
const DARAZ_RATE_LIMITS: Record<string, number> = {
  '/order/get': 20,         // Orders API - conservative limit
  '/order/items/get': 20,   // Order items API
  '/products/get': 10,      // Product catalog API
  '/auth/token/refresh': 2, // Token refresh - very conservative
  // Default fallback
  'default': 5
};

// Get rate limiter for specific endpoint
function getRateLimiterForEndpoint(apiPath: string): DarazRateLimiter {
  const rateLimit = DARAZ_RATE_LIMITS[apiPath] || DARAZ_RATE_LIMITS['default'];
  return new DarazRateLimiter(1000 / rateLimit); // Convert QPS to ms interval
}

export type DarazCountryCode = 'PK' | 'BD' | 'LK' | 'NP' | 'MM';

export type DarazErrorCategory =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN";

const GATEWAY_MAP: Record<DarazCountryCode, string> = {
  PK: 'https://api.daraz.pk/rest',
  BD: 'https://api.daraz.com.bd/rest',
  LK: 'https://api.daraz.lk/rest',
  NP: 'https://api.daraz.com.np/rest',
  MM: 'https://api.shop.com.mm/rest',
};

export interface SyncApiLogParams {
  storeId: string;
  module: string;
  endpoint: string;
  page?: number;
  startedAt: string;
  completedAt?: string;
  records?: number;
  retryCount?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Persists detailed diagnostic logs into daraz_sync_logs table.
 * Strictly redacts all access tokens, refresh tokens, and App Secrets.
 */
export async function logSyncApiRequest(params: SyncApiLogParams): Promise<void> {
  if (!params.storeId) return;
  const supabase = createAdminClient();
  try {
    const cleanErrorMsg = params.errorMessage
      ? String(params.errorMessage).replace(/(access_token|refresh_token|app_secret|secret|password|sign)=[^&,\s]+/gi, '$1=[REDACTED]')
      : null;

    await supabase.from('daraz_sync_logs').insert({
      store_id: params.storeId,
      module: params.module,
      endpoint: params.endpoint,
      page: params.page || 1,
      started_at: params.startedAt,
      completed_at: params.completedAt || new Date().toISOString(),
      records: params.records || 0,
      retry_count: params.retryCount || 0,
      error_code: params.errorCode || null,
      error_message: cleanErrorMsg,
    });
  } catch (err: any) {
    console.warn(`[DarazClient Log] Warning writing to daraz_sync_logs: ${err?.message}`);
  }
}

export interface DarazClientConfig {
  storeId?: string;
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | number | Date;
  countryCode?: DarazCountryCode;
}

export interface DarazCatalogSku {
  seller_sku: string;
  daraz_sku_id?: string;
  shop_sku?: string;
  item_id?: string;
  price_cents: number;
  special_price_cents?: number;
  quantity: number;
  reserved_quantity?: number;
  status?: string;
  images?: string[];
  [key: string]: any;
}

export interface DarazCatalogItem {
  item_id: string;
  title: string;
  category?: string;
  brand?: string;
  status?: string;
  description?: string;
  images?: string[];
  attributes?: Record<string, any>;
  skus: DarazCatalogSku[];
  [key: string]: any;
}

export interface DarazCatalogResult {
  items: DarazCatalogItem[];
  total_items: number;
  raw_items_count: number;
  skipped_items: number;
  skipped_skus: number;
}

export interface DarazOrderItem {
  order_item_id?: string | number;
  item_id?: string | number;
  order_id?: string | number;
  name?: string;
  seller_sku?: string;
  shop_sku?: string;
  quantity?: number;
  item_price_cents?: number;
  paid_price_cents?: number;
  status?: string;
  shipment_provider?: string;
  tracking_code?: string;
  product_main_image?: string;
  raw?: any;
  [key: string]: any;
}

export interface DarazOrder {
  order_id?: string | number;
  order_number?: string | number;
  package_id?: string;
  statuses?: string[];
  status?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_city?: string;
  customer_phone?: string;
  customer_address?: string;
  price?: number | string;
  price_cents?: number;
  tracking_code?: string;
  created_at?: string;
  items?: DarazOrderItem[];
  raw?: any;
  [key: string]: any;
}

export class DarazClient {
  public storeId?: string;
  private appKey: string;
  private appSecret: string;
  private baseUrl: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: string | number | Date;

  constructor(config: DarazClientConfig = {}) {
    const key = config.appKey || process.env.DARAZ_APP_KEY;
    const secret = config.appSecret || process.env.DARAZ_APP_SECRET;
    if (!key || !secret) {
      throw new Error(
        "DARAZ_APP_KEY and DARAZ_APP_SECRET must be set in environment " +
        "variables. This ERP cannot make Daraz API calls without its " +
        "own registered app credentials."
      );
    }
    this.storeId = config.storeId;
    this.appKey = key.trim();
    this.appSecret = secret.trim();
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
    this.tokenExpiresAt = config.tokenExpiresAt;
    const country = (config.countryCode || 'PK').toUpperCase() as DarazCountryCode;
    this.baseUrl = GATEWAY_MAP[country] || GATEWAY_MAP.PK;
  }

  public setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async prepareParams(
    apiPath: string,
    businessParams: DarazSignParams = {}
  ): Promise<Record<string, string>> {
    const timestamp = Date.now().toString();
    const allParams: DarazSignParams = {
      app_key: this.appKey,
      timestamp,
      sign_method: 'sha256',
      ...businessParams,
    };

    if (this.accessToken && !allParams.access_token) {
      allParams.access_token = this.accessToken;
    }

    const signature = await signDarazRequest(apiPath, allParams, this.appSecret);
    const finalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== undefined && v !== null) finalized[k] = String(v);
    }
    finalized.sign = signature;
    return finalized;
  }

  private static refreshLocks = new Map<string, Promise<void>>();

  private async requestWithRetry<T>(
    requestFn: () => Promise<Response>,
    apiPath: string,
    maxRetries = 3
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      // Rate Throttling: use endpoint-specific rate limiter
      const rateLimiter = getRateLimiterForEndpoint(apiPath);
      await rateLimiter.acquire();

      try {
        const res = await requestFn();

        let retryAfterMs = 0;
        if (res && res.headers && typeof res.headers.get === 'function') {
          const retryAfterHeader = res.headers.get('Retry-After') || res.headers.get('retry-after');
          if (retryAfterHeader) {
            const parsedSec = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSec) && parsedSec > 0) {
              retryAfterMs = parsedSec * 1000;
            }
          }
        }

        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxRetries) {
            attempt++;
            const jitter = Math.floor(Math.random() * 200);
            const backoffMs = retryAfterMs > 0 ? retryAfterMs : Math.min(10000, 500 * Math.pow(2, attempt) + jitter);
            console.warn(`[DarazClient] HTTP ${res.status} on ${apiPath}. Retrying attempt ${attempt}/${maxRetries} in ${backoffMs}ms...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
        }
        return await this.parseResponse<T>(res, apiPath);
      } catch (err: any) {
        const errMsg = String(err?.message || err);

        // Check for authentication failure errors requiring token refresh
        const isAuthError =
          errMsg.includes('401') ||
          errMsg.includes('InAuthorized') ||
          errMsg.includes('IllegalAccessToken') ||
          errMsg.includes('15') ||
          errMsg.includes('INVALID_ACCESS_TOKEN') ||
          errMsg.toLowerCase().includes('access token');

        if (isAuthError && this.storeId && attempt === 0) {
          try {
            console.warn(`[DarazClient] Auth error "${errMsg}" on ${apiPath}. Attempting token refresh for store ${this.storeId}...`);
            await this.refreshTokenIfNeeded();
            this.accessToken = await this.getFreshAccessToken(); // Get the updated token
            attempt++;
            console.log(`[DarazClient] Token refreshed successfully. Retrying request on ${apiPath}...`);
            continue;
          } catch (refErr: any) {
            console.error(`[DarazClient] Automatic token refresh failed: ${refErr.message}`);
            throw new Error(`TOKEN_REFRESH_FAILED: ${refErr.message}`);
          }
        }

        const isRateLimitOrTransient =
          errMsg.includes('429') ||
          errMsg.includes('RateLimitExceeded') ||
          errMsg.includes('RequestLimitExceeded') ||
          errMsg.includes('Too Many Requests') ||
          errMsg.includes('ETIMEDOUT') ||
          errMsg.includes('ECONNRESET') ||
          errMsg.includes('fetch failed');

        if (isRateLimitOrTransient && attempt < maxRetries) {
          attempt++;
          const jitter = Math.floor(Math.random() * 200);
          const backoffMs = Math.min(10000, 500 * Math.pow(2, attempt) + jitter);
          console.warn(`[DarazClient] Transient error "${errMsg}" on ${apiPath}. Retrying attempt ${attempt}/${maxRetries} in ${backoffMs}ms...`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        throw err;
      }
    }
  }

  // Improved token refresh with locking mechanism to prevent race conditions
  public async refreshTokenIfNeeded(): Promise<void> {
    if (!this.storeId || !this.refreshToken) return;

    const lockKey = `refresh_${this.storeId}`;
    if (DarazClient.refreshLocks.has(lockKey)) {
      await DarazClient.refreshLocks.get(lockKey);
      return;
    }

    const refreshPromise = this._performTokenRefresh();
    DarazClient.refreshLocks.set(lockKey, refreshPromise);

    try {
      await refreshPromise;
    } finally {
      DarazClient.refreshLocks.delete(lockKey);
    }
  }

  private async _performTokenRefresh(): Promise<void> {
    const tempClient = new DarazClient({
      appKey: this.appKey,
      appSecret: this.appSecret,
      countryCode: 'PK', // Will be overridden by store-specific config
    });

    const res: any = await tempClient.post('/auth/token/refresh', {
      refresh_token: this.refreshToken,
    });

    this.accessToken = res.access_token;
    this.refreshToken = res.refresh_token || this.refreshToken; // Keep old if not rotated
    if (res.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + res.expires_in * 1000);
    }
  }

  private async getFreshAccessToken(): Promise<string> {
    // Return the current access token (should be updated after refresh)
    if (!this.accessToken) {
      throw new Error('No access token available after refresh');
    }
    return this.accessToken;
  }

  private classifyDarazError(error: any): DarazErrorCategory {
    const msg = String(error?.message || error || "").toLowerCase();

    // More precise error matching to avoid false positives
    if (/\b15\b/.test(msg) || msg.includes('inauthorized') ||
        msg.includes('invalid_access_token') || msg.includes('illegalaccesstoken')) {
      return "AUTH_ERROR";
    }
    if (msg.includes('rate limit') || msg.includes('qps') ||
        msg.includes('too many requests') || msg.includes('429')) {
      return "RATE_LIMIT";
    }
    if (msg.includes('timeout') || msg.includes('timed out') ||
        msg.includes('etimedout')) {
      return "TIMEOUT";
    }
    if (msg.includes('network') || msg.includes('econnreset') ||
        msg.includes('fetch failed')) {
      return "NETWORK_ERROR";
    }
    if (msg.includes('validation') || msg.includes('invalid') ||
        msg.includes('bad request')) {
      return "VALIDATION_ERROR";
    }
    if (msg.includes('not found') || msg.includes('404')) {
      return "NOT_FOUND";
    }
    if (msg.includes('permission') || msg.includes('forbidden') ||
        msg.includes('403')) {
      return "PERMISSION_ERROR";
    }
    if (msg.includes('database') || msg.includes('supabase') ||
        msg.includes('postgres') || msg.includes('duplicate key')) {
      return "DATABASE_ERROR";
    }
    return "UNKNOWN";
  }

  public async get<T = any>(apiPath: string, params: DarazSignParams = {}): Promise<T> {
    const normPath = normalizeApiPath(apiPath);
    const finalized = await this.prepareParams(normPath, params);
    const query = new URLSearchParams(finalized).toString();
    return this.requestWithRetry<T>(
      async () => {
        // Generate correlation ID for tracing
        const correlationId = crypto.randomUUID();
        const startTime = Date.now();

        try {
          const res = await fetch(`${this.baseUrl}${normPath}?${query}`, {
            method: 'GET',
            headers: { Accept: 'application/json' }
          });

          // Log the API call (redact sensitive info)
          await this.logApiCall({
            correlationId,
            storeId: this.storeId,
            endpoint: normPath,
            method: 'GET',
            status: res.status,
            durationMs: Date.now() - startTime,
            errorCode: res.status >= 400 ? String(res.status) : undefined
          });

          return res;
        } catch (err: any) {
          // Log failed API call
          await this.logApiCall({
            correlationId,
            storeId: this.storeId,
            endpoint: normPath,
            method: 'GET',
            status: 0, // Network error
            durationMs: Date.now() - startTime,
            errorCode: 'NETWORK_ERROR',
            errorMessage: String(err?.message || err)
          });
          throw err;
        }
      },
      normPath
    );
  }

  private async logApiCall(params: {
    correlationId: string;
    storeId?: string;
    endpoint: string;
    method: string;
    status: number;
    durationMs: number;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const supabase = createAdminClient();
      await supabase.from('daraz_api_audit').insert({
        correlation_id: params.correlationId,
        store_id: params.storeId,
        endpoint: params.endpoint,
        method: params.method,
        response_status: params.status,
        error_code: params.errorCode,
        error_message: params.errorMessage,
        duration_ms: params.durationMs,
        created_at: new Date().toISOString()
      });
    } catch (e: any) {
      // Don't let logging errors break the main flow
      console.warn('[DarazClient] Failed to log API call:', e.message);
    }
  }

  public async post<T = any>(apiPath: string, params: DarazSignParams = {}): Promise<T> {
    const normPath = normalizeApiPath(apiPath);
    const finalized = await this.prepareParams(normPath, params);
    const body = new URLSearchParams(finalized).toString();
    return this.requestWithRetry<T>(
      () => fetch(`${this.baseUrl}${normPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Accept: 'application/json',
        },
        body,
      }),
      normPath
    );
  }

  public async getOrderDetails(orderId: string | number): Promise<any> {
    const response: any = await this.get('/order/get', { order_id: String(orderId) });
    return response.data || response;
  }

  public async getOrderItems(orderId: string | number): Promise<any[]> {
    const response: any = await this.get('/order/items/get', { order_id: String(orderId) });
    return response.data || response;
  }

  public async getStoreProfile(): Promise<any> {
    const response: any = await this.get('/seller/get');
    const dataObj = response.data || response.result || response || {};
    return {
      seller_id: String(dataObj.seller_id || dataObj.short_code || 'SELLER_UNKNOWN'),
      name: dataObj.name || dataObj.short_code || 'Daraz Store',
      short_code: dataObj.short_code || 'STORE-01',
      email: dataObj.email || '',
      location: dataObj.location || 'Pakistan',
    };
  }

  public async getCatalogItems(offset = 0, limit = 50, filter = 'all', updateAfter?: string, keyword?: string): Promise<DarazCatalogResult> {
    const params: Record<string, string> = {
      filter: filter || 'all',
      offset: String(offset),
      limit: String(limit),
    };
    if (updateAfter) {
      params.update_after = updateAfter;
    }
    if (keyword) {
      params.keyword = keyword;
    }

    const response: any = await this.get('/products/get', params);

    const dataObj = response.data || response.result || response;
    let rawProducts: any[] = [];

    if (Array.isArray(dataObj)) rawProducts = dataObj;
    else if (Array.isArray(dataObj?.products)) rawProducts = dataObj.products;
    else if (Array.isArray(dataObj?.products?.product)) rawProducts = dataObj.products.product;
    else if (Array.isArray(dataObj?.products_list)) rawProducts = dataObj.products_list;
    else if (Array.isArray(dataObj?.items)) rawProducts = dataObj.items;
    else if (Array.isArray(dataObj?.Items)) rawProducts = dataObj.Items;
    else if (Array.isArray(dataObj?.Products)) rawProducts = dataObj.Products;
    else if (Array.isArray(dataObj?.Products?.Product)) rawProducts = dataObj.Products.Product;
    else if (Array.isArray(dataObj?.product)) rawProducts = dataObj.product;

    const total_items = parseInt(String(dataObj?.total_products ?? dataObj?.total ?? rawProducts.length), 10) || rawProducts.length;
    const raw_items_count = rawProducts.length;
    const items: any[] = [];
    let skipped_items = 0;
    let skipped_skus = 0;

    rawProducts.forEach((p) => {
      const rawItemId = p.item_id || p.ItemId || p.itemId || '';
      const itemId = String(rawItemId || '').trim();

      if (!itemId) {
        skipped_items++;
        return;
      }

      const rawAttributes: Record<string, any> = p.attributes || p.Attributes || {};
      const skuCollection = p.skus || p.Skus || [];
      const rawSkus: any[] = Array.isArray(skuCollection) && skuCollection.length > 0 ? skuCollection : [{}];
      const parsedSkus: any[] = [];

      rawSkus.forEach((sku: any) => {
        const rawSellerSku = sku.SellerSku || sku.seller_sku || sku.sellerSku || sku.SellerSKU || '';
        const sellerSku = String(rawSellerSku || '').trim();

        if (!sellerSku) {
          skipped_skus++;
          return;
        }

        const rawQty = sku.quantity ?? sku.Quantity ?? sku.Available ?? sku.available ?? 0;
        const parsedQuantity = Math.max(0, parseInt(String(rawQty), 10) || 0);

        const rawReserved = sku.withholding_quantity ?? sku.WithholdingQuantity ?? sku.reserved_quantity ?? sku.ReservedQuantity ?? 0;
        const parsedReserved = Math.max(0, parseInt(String(rawReserved), 10) || 0);

        const rawPrice = sku.price ?? sku.Price ?? sku.SalePrice ?? sku.sale_price ?? 0;
        const priceCents = Math.round((parseFloat(String(rawPrice)) || 0) * 100);

        const specialPrice = sku.special_price ?? sku.SpecialPrice ?? sku.SalePrice ?? sku.sale_price;
        const specialPriceCents = specialPrice !== null && specialPrice !== undefined && specialPrice !== rawPrice
          ? Math.round(parseFloat(String(specialPrice)) * 100) || undefined
          : undefined;

        const rawBarcode = sku.barcode || sku.Barcode || sku.ean || sku.Ean || sku.gtin || rawAttributes.barcode || rawAttributes.Barcode || null;

        parsedSkus.push({
          seller_sku: sellerSku,
          daraz_sku_id: String(sku.SkuId || sku.skuId || sku.sku_id || sku.ShopSku || ''),
          shop_sku: String(sku.ShopSku || sku.shop_sku || sku.SkuId || ''),
          barcode: rawBarcode ? String(rawBarcode).trim() : null,
          item_id: itemId,
          price_cents: priceCents,
          special_price_cents: specialPriceCents,
          quantity: parsedQuantity,
          reserved_quantity: parsedReserved,
          status: String(sku.Status || sku.status || p.status || 'active').toLowerCase(),
          images: [],
        });
      });

      if (parsedSkus.length === 0) {
        skipped_items++;
        return;
      }

      const title = rawAttributes.name_en || rawAttributes.NameEn || rawAttributes.name || rawAttributes.Name || p.title || p.Title || p.name || '';

      items.push({
        item_id: itemId,
        title,
        category: String(p.primary_category || p.PrimaryCategory || 'General'),
        brand: String(rawAttributes.brand || rawAttributes.Brand || 'Generic'),
        status: String(p.status || p.Status || 'active').toLowerCase(),
        description: p.description || '',
        images: [],
        attributes: rawAttributes,
        skus: parsedSkus,
      });
    });

    return { items, total_items, raw_items_count, skipped_items, skipped_skus };
  }

  public async getOrders(offset = 0, limit = 100, updateAfter?: string): Promise<any> {
    const params: Record<string, string> = {
      sort_by: 'created_at',
      sort_direction: 'DESC',
      offset: String(offset),
      limit: String(limit),
      update_after: updateAfter || '2020-01-01T00:00:00Z',
    };

    const response: any = await this.get('/orders/get', params);
    const dataObj = response.data || response.result || response;
    let rawOrders: any[] = [];

    if (Array.isArray(dataObj)) rawOrders = dataObj;
    else if (Array.isArray(dataObj?.orders)) rawOrders = dataObj.orders;
    else if (Array.isArray(dataObj?.orders?.order)) rawOrders = dataObj.orders.order;

    const total = dataObj?.countTotal ?? dataObj?.count ?? rawOrders.length;

    const orders = rawOrders.map((o) => {
      const addressShipping = o.address_shipping || {};
      const addressBilling = o.address_billing || {};
      let rawStatus = 'pending';
      if (Array.isArray(o.statuses) && o.statuses.length > 0) rawStatus = String(o.statuses[0]);
      else if (typeof o.statuses === 'string' && o.statuses.trim()) rawStatus = o.statuses.trim();

      return {
        order_id: String(o.order_id || o.orderId || ''),
        order_number: String(o.order_number || o.order_id || ''),
        package_id: String(o.package_id || ''),
        customer_first_name: o.customer_first_name || addressShipping.first_name || addressBilling.first_name || 'Customer',
        customer_city: addressShipping.city || addressBilling.city || 'Karachi',
        price_cents: Math.round((parseFloat(String(o.price || 0)) || 0) * 100),
        statuses: rawStatus.toLowerCase().replace(/[-\s]+/g, '_'),
        tracking_code: o.tracking_code || o.tracking_number || o.TrackingCode || addressShipping.tracking_code || null,
        created_at: String(o.created_at || ''),
        items: [],
        raw: o,
      };
    });

    return { orders, total };
  }

  public async updatePriceAndQuantity(skuUpdates: Array<{ sellerSku: string; itemId?: string | number; skuId?: string | number; quantity?: number; priceCents?: number; specialPriceCents?: number }>): Promise<boolean> {
    if (!skuUpdates || skuUpdates.length === 0) return true;
    const itemsXml = skuUpdates.map((s) => {
      let xml = `<Sku><SellerSku><![CDATA[${s.sellerSku}]]></SellerSku>`;
      if (s.itemId) xml += `<ItemId>${s.itemId}</ItemId>`;
      if (s.skuId) xml += `<SkuId>${s.skuId}</SkuId>`;
      if (s.quantity !== undefined) xml += `<Quantity>${s.quantity}</Quantity>`;
      if (s.priceCents !== undefined) xml += `<Price>${(s.priceCents / 100).toFixed(2)}</Price>`;
      if (s.specialPriceCents !== undefined) xml += `<SalePrice>${(s.specialPriceCents / 100).toFixed(2)}</SalePrice>`;
      xml += `</Sku>`;
      return xml;
    }).join('');
    const payload = `<Request><Product><Skus>${itemsXml}</Skus></Product></Request>`;
    const res: any = await this.post('/product/price_quantity/update', { payload });
    return !res.code || res.code === '0' || res.code === 0;
  }

  public async updateProduct(itemId: string, sku: string, attributes: Record<string, any>, images?: string[]): Promise<boolean> {
    const payload = JSON.stringify({ Request: { Product: { ItemId: itemId, Attributes: attributes, Skus: { Sku: [{ SellerSku: sku, Images: images ? { Image: images } : undefined }] } } } });
    const res: any = await this.post('/product/update', { payload });
    return !res.code || res.code === '0' || res.code === 0;
  }

  public async packOrder(itemIds: string[], shippingProvider: string): Promise<{ success: boolean; packageId?: string }> {
    const orderItemListStr = JSON.stringify(itemIds);
    const res: any = await this.post('/order/pack', {
      order_item_list: orderItemListStr,
      delivery_type: 'dropship',
      shipping_provider: shippingProvider || 'Daraz Express (DEX)',
    });
    const dataObj = res?.data || res?.result || res || {};
    let packageId: string | undefined = undefined;
    if (Array.isArray(dataObj?.packages) && dataObj.packages.length > 0) {
      packageId = String(dataObj.packages[0].package_id || dataObj.packages[0].packageId || '');
    } else if (dataObj?.package_id || dataObj?.packageId) {
      packageId = String(dataObj.package_id || dataObj.packageId);
    }
    return { success: !res.code || res.code === '0' || res.code === 0, packageId };
  }

  public async setReadyToShip(itemIds: string[], trackingNumber: string, shippingProvider: string, packageId?: string): Promise<{ success: boolean }> {
    const params: Record<string, string> = {
      order_item_ids: JSON.stringify(itemIds),
      delivery_type: 'dropship',
      shipping_provider: shippingProvider || 'Daraz Express (DEX)',
      tracking_number: trackingNumber || '',
    };
    if (packageId) params.package_id = packageId;
    const res: any = await this.post('/order/package/rts', params);
    return { success: !res.code || res.code === '0' || res.code === 0 };
  }

  public async getShippingDocument(itemIds: string[], docType = 'shippingLabel', packageId?: string): Promise<{ file: string; mimeType: string; raw: any }> {
    const params: Record<string, string> = {
      doc_type: docType,
      order_item_ids: JSON.stringify(itemIds),
    };
    if (packageId) params.package_id = packageId;
    const res: any = await this.get('/order/document/get', params);
    const dataObj = res.data || res.result || res;
    return {
      file: dataObj?.document?.file || dataObj?.document || dataObj?.file || '',
      mimeType: dataObj?.document?.mime_type || dataObj?.mime_type || 'application/pdf',
      raw: dataObj,
    };
  }

  public async shipOrder(params: { orderId: string; trackingNumber?: string; courier?: string }): Promise<{ success: boolean; data?: any }> {
    const res: any = await this.post('/order/ship', {
      order_id: params.orderId,
      tracking_number: params.trackingNumber || '',
      courier: params.courier || 'Daraz Express (DEX)',
    });
    return {
      success: !res.code || res.code === '0' || res.code === 0,
      data: res.data || res.result || res,
    };
  }

  public async updatePriceQuantity(updates: Array<{ sellerSku: string; price?: number; quantity?: number }>): Promise<{ success: boolean; data?: any }> {
    const productsPayload = JSON.stringify({
      Request: {
        Product: {
          Skus: {
            Sku: updates.map((u) => ({
              SellerSku: u.sellerSku,
              Price: typeof u.price === 'number' ? u.price : undefined,
              Quantity: typeof u.quantity === 'number' ? u.quantity : undefined,
            })),
          },
        },
      },
    });

    const res: any = await this.post('/product/price_quantity/update', { payload: productsPayload });
    return {
      success: !res.code || res.code === '0' || res.code === 0,
      data: res.data || res.result || res,
    };
  }

  private async parseResponse<T>(res: Response, path: string): Promise<T> {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Daraz HTTP ${res.status}] Path: ${path} - Error: ${errText}`);
    }
    const json = await res.json();

    // Check for nested error_response or top-level code errors
    const errObj = json.error_response || json.errorResponse || (json.code && json.code !== '0' && json.code !== 0 ? json : null);

    if (errObj) {
      const code = String(errObj.code || json.code || 'UNKNOWN_ERROR');
      const msg = errObj.msg || errObj.message || errObj.type || json.message || json.msg || json.type || 'Unknown Daraz API Error';
      throw new Error(`[Daraz Error] Code: ${code} | Message: ${msg}`);
    }
    return json;
  }
}

// -----------------------------------------------------------------------------
// Compatibility & Diagnostic Helpers
// -----------------------------------------------------------------------------

export function humanizeDarazApiError(code: string, rawMessage?: string): string {
  const cleanMsg = rawMessage ? rawMessage.trim() : '';

  switch (code) {
    case 'InAuthorized':
    case 'IllegalAccessToken':
    case '15':
    case '401':
      return 'Your Daraz store connection has expired. Please reconnect your store via My Stores.';
    case '429':
    case 'RateLimitExceeded':
    case 'RequestLimitExceeded':
    case 'Too Many Requests':
      return 'Daraz API request limit reached. Please wait a few moments and try again.';
    case 'B1001':
    case 'InvalidItem':
      return 'Daraz Seller Center could not find this product SKU or Item ID.';
    case 'B1002':
    case 'InvalidStock':
      return 'Daraz rejected stock update: Invalid stock quantity or withholding lock active on Seller Center.';
    case 'OrderAlreadyPacked':
    case 'OrderStateInvalid':
      return 'Daraz rejected status update: Order is already packed or in an incompatible status on Seller Center.';
    default:
      return cleanMsg || `Daraz API returned error code [${code}].`;
  }
}

export function sanitizeLogPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  const SENSITIVE_KEYS = [
    'access_token', 'refresh_token', 'token', 'api_key', 'app_key',
    'app_secret', 'api_app_key', 'api_app_secret', 'secret', 'password',
    'authorization', 'auth_token',
  ];

  try {
    const sanitized = { ...payload };
    for (const key of SENSITIVE_KEYS) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  } catch (e) {
    return { sanitized: true };
  }
}

import { decryptSecret } from '../security/encryption';

export async function getDarazClient(storeId: string): Promise<DarazClient> {
  const supabase = createAdminClient();

  const { data: store, error } = await supabase
    .from('daraz_stores')
    .select('id, daraz_app_id, region, is_active')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    throw new Error(`Store ${storeId} not found in database: ${error?.message || 'unknown'}`);
  }

  const { data: creds } = await supabase
    .from('daraz_store_credentials')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  let resolvedAppKey = (creds?.api_app_key || '').trim();
  let rawSecret = creds?.api_app_secret || '';
  let accessToken = creds?.access_token || undefined;
  let refreshToken = creds?.refresh_token || undefined;
  let tokenExpiresAt = creds?.token_expires_at || undefined;

  if ((!resolvedAppKey || !rawSecret) && store.daraz_app_id) {
    const { data: appData } = await supabase
      .from('daraz_apps')
      .select('app_key, encrypted_app_secret')
      .eq('id', store.daraz_app_id)
      .maybeSingle();

    if (appData) {
      if (!resolvedAppKey) resolvedAppKey = (appData.app_key || '').trim();
      if (!rawSecret) rawSecret = appData.encrypted_app_secret || '';
    }
  }

  if (!resolvedAppKey) resolvedAppKey = (process.env.DARAZ_APP_KEY || '').trim();
  if (!rawSecret) rawSecret = process.env.DARAZ_APP_SECRET || '';

  const decryptedSecret = decryptSecret(rawSecret) || rawSecret;

  if (!resolvedAppKey || !decryptedSecret) {
    throw new Error(`Store ${storeId} does not have valid Daraz application credentials configured.`);
  }

  return new DarazClient({
    appKey: resolvedAppKey,
    appSecret: decryptedSecret.trim(),
    countryCode: (store.region || 'PK') as DarazCountryCode,
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });
}

/**
 * High-level DarazApiClient alias mapping directly to DarazClient
 */
export const DarazApiClient = DarazClient;
export type DarazApiClient = DarazClient;
