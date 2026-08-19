import { signDarazRequest, DarazSignParams, normalizeApiPath } from './signature';
import { createAdminClient } from '../supabase/admin';

export type DarazCountryCode = 'PK' | 'BD' | 'LK' | 'NP' | 'MM';

const GATEWAY_MAP: Record<DarazCountryCode, string> = {
  PK: 'https://api.daraz.pk/rest',
  BD: 'https://api.daraz.com.bd/rest',
  LK: 'https://api.daraz.lk/rest',
  NP: 'https://api.daraz.com.np/rest',
  MM: 'https://api.shop.com.mm/rest',
};

export interface DarazClientConfig {
  appKey: string;
  appSecret: string;
  countryCode?: DarazCountryCode;
  accessToken?: string;
}

export class DarazClient {
  private appKey: string;
  private appSecret: string;
  private baseUrl: string;
  private accessToken?: string;

  constructor(config: DarazClientConfig) {
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.accessToken = config.accessToken;
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

  public async get<T = any>(apiPath: string, params: DarazSignParams = {}): Promise<T> {
    const normPath = normalizeApiPath(apiPath);
    const finalized = await this.prepareParams(normPath, params);
    const query = new URLSearchParams(finalized).toString();
    const res = await fetch(`${this.baseUrl}${normPath}?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return this.parseResponse<T>(res, normPath);
  }

  public async post<T = any>(apiPath: string, params: DarazSignParams = {}): Promise<T> {
    const normPath = normalizeApiPath(apiPath);
    const finalized = await this.prepareParams(normPath, params);
    const body = new URLSearchParams(finalized).toString();
    const res = await fetch(`${this.baseUrl}${normPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        Accept: 'application/json',
      },
      body,
    });
    return this.parseResponse<T>(res, normPath);
  }

  private async parseResponse<T>(res: Response, path: string): Promise<T> {
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Daraz HTTP ${res.status}] Path: ${path} - Error: ${errText}`);
    }
    const json = await res.json();
    if (json.code && json.code !== '0' && json.code !== 0) {
      throw new Error(`[Daraz Error] Code: ${json.code} | Message: ${json.message || json.type || 'Unknown Error'}`);
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

export async function getDarazClient(storeId: string): Promise<DarazClient> {
  const supabase = createAdminClient();

  const { data: store, error } = await supabase
    .from('daraz_stores')
    .select('id, access_token, refresh_token, token_expires_at, api_app_key, api_app_secret, country_code, region')
    .eq('id', storeId)
    .single();

  if (error || !store) {
    throw new Error(`Store ${storeId} not found in database: ${error?.message || 'unknown'}`);
  }

  return new DarazClient({
    appKey: store.api_app_key || process.env.DARAZ_APP_KEY || '',
    appSecret: store.api_app_secret || process.env.DARAZ_APP_SECRET || '',
    countryCode: (store.country_code || store.region || 'PK') as DarazCountryCode,
    accessToken: store.access_token || undefined,
  });
}

/**
 * High-level DarazApiClient adapter wrapping DarazClient for existing callers & test runner
 */
export class DarazApiClient {
  private client: DarazClient;

  constructor(options: { appKey?: string; appSecret?: string; accessToken?: string; countryCode?: DarazCountryCode } = {}) {
    this.client = new DarazClient({
      appKey: options.appKey || process.env.DARAZ_APP_KEY || '',
      appSecret: options.appSecret || process.env.DARAZ_APP_SECRET || '',
      countryCode: options.countryCode || 'PK',
      accessToken: options.accessToken,
    });
  }

  async getStoreProfile(): Promise<any> {
    const response: any = await this.client.get('/seller/get');
    const dataObj = response.data || response.result || response || {};
    return {
      seller_id: String(dataObj.seller_id || dataObj.short_code || 'SELLER_UNKNOWN'),
      name: dataObj.name || dataObj.short_code || 'Daraz Store',
      short_code: dataObj.short_code || 'STORE-01',
      email: dataObj.email || '',
      location: dataObj.location || 'Pakistan',
    };
  }

  async getCatalogItems(offset = 0, limit = 50): Promise<any> {
    const response: any = await this.client.get('/products/get', {
      filter: 'all',
      offset: String(offset),
      limit: String(limit),
    });

    const dataObj = response.data || response.result || response;
    let rawProducts: any[] = [];

    if (Array.isArray(dataObj)) rawProducts = dataObj;
    else if (Array.isArray(dataObj?.products)) rawProducts = dataObj.products;
    else if (Array.isArray(dataObj?.products?.product)) rawProducts = dataObj.products.product;
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

        parsedSkus.push({
          seller_sku: sellerSku,
          daraz_sku_id: String(sku.SkuId || sku.skuId || sku.sku_id || sku.ShopSku || ''),
          shop_sku: String(sku.ShopSku || sku.shop_sku || sku.SkuId || ''),
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

  async getOrders(offset = 0, limit = 100, updateAfter?: string): Promise<any> {
    const params: Record<string, string> = {
      sort_by: 'created_at',
      sort_direction: 'DESC',
      offset: String(offset),
      limit: String(limit),
      update_after: updateAfter || '2020-01-01T00:00:00Z',
    };

    const response: any = await this.client.get('/orders/get', params);
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
        created_at: String(o.created_at || ''),
        items: [],
        raw: o,
      };
    });

    return { orders, total };
  }

  async packOrder(itemIds: string[], shippingProvider: string): Promise<{ success: boolean; packageId?: string }> {
    const orderItemListStr = JSON.stringify(itemIds);
    const res: any = await this.client.post('/order/pack', {
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

  async setReadyToShip(itemIds: string[], trackingNumber: string, shippingProvider: string, packageId?: string): Promise<{ success: boolean }> {
    const params: Record<string, string> = {
      order_item_ids: JSON.stringify(itemIds),
      delivery_type: 'dropship',
      shipping_provider: shippingProvider || 'Daraz Express (DEX)',
      tracking_number: trackingNumber || '',
    };
    if (packageId) params.package_id = packageId;

    const res: any = await this.client.post('/order/package/rts', params);
    return { success: !res.code || res.code === '0' || res.code === 0 };
  }
}
