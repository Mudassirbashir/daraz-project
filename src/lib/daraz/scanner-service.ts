import { DarazApiClient } from './client';
import { getValidStoreAccessToken } from './store-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { logSyncApiRequest } from './client';

interface ScanResult {
  success: boolean;
  data?: any;
  error?: string;
  cached: boolean;
  timestamp: string;
}

interface ScanCacheEntry {
  result: ScanResult;
  expiresAt: number;
}

/**
 * In-memory cache for recent barcode scans to prevent duplicate scans within a short time.
 * Key: `${storeId}:${barcode}`
 */
const scanCache = new Map<string, ScanCacheEntry>();

// Cache TTL: 30 seconds
const SCAN_CACHE_TTL_MS = 30 * 1000;

// Debounce delay: 500ms to prevent rapid-fire scans
const DEBOUNCE_DELAY_MS = 500;

/**
 * Get or create a debounced function
 */
function debounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    return new Promise<ReturnType<T>>((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

/**
 * Clean expired cache entries
 */
function cleanCache() {
  const now = Date.now();
  for (const [key, entry] of scanCache.entries()) {
    if (entry.expiresAt < now) {
      scanCache.delete(key);
    }
  }
}

/**
 * Handle a barcode scan for a store
 * @param storeId - The store ID
 * @param barcode - The barcode to scan
 * @returns Scan result with data or error
 */
export const handleBarcodeScan = debounce(
  async (storeId: string, barcode: string): Promise<ScanResult> => {
    // Clean cache periodically
    cleanCache();

    const cacheKey = `${storeId}:${barcode}`;
    const now = Date.now();

    // Check cache for recent scan
    const cachedEntry = scanCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > now) {
      return {
        ...cachedEntry.result,
        cached: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Not in cache or expired, perform scan
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      // Get valid Daraz client for the store
      const { client } = await getValidStoreAccessToken(storeId);

      // Search for products by barcode
      // Note: Daraz API doesn't have a direct barcode lookup endpoint in the public API
      // We'll use the catalog search with barcode as keyword
      const searchResults = await client.getCatalogItems(0, 20, 'all', undefined, barcode);

      // Process results
      if (searchResults && searchResults.items && searchResults.items.length > 0) {
        // Take the first match
        const product = searchResults.items[0];

        // Find SKU that matches the barcode (if multiple SKUs)
        let matchedSku = null;
        if (product.skus && product.skus.length > 0) {
          matchedSku = product.skus.find((sku: any) =>
            String(sku.barcode || '').trim() === barcode.trim()
          ) || product.skus[0]; // Fallback to first SKU
        }

        const result: ScanResult = {
          success: true,
          data: {
            product: {
              itemId: product.item_id,
              title: product.title,
              category: product.category,
              brand: product.brand,
              description: product.description,
              images: product.images,
              productUrl: product.product_url,
            },
            sku: matchedSku ? {
              sellerSku: matchedSku.seller_sku,
              darazSkuId: matchedSku.daraz_sku_id,
              shopSku: matchedSku.shop_sku,
              barcode: matchedSku.barcode,
              priceCents: matchedSku.price_cents,
              quantity: matchedSku.quantity,
              status: matchedSku.status,
              images: matchedSku.images,
            } : null,
          },
          error: undefined,
          cached: false,
          timestamp,
        };

        // Cache the result
        scanCache.set(cacheKey, {
          result,
          expiresAt: now + SCAN_CACHE_TTL_MS,
        });

        // Log successful scan API request
        await logSyncApiRequest({
          storeId,
          module: 'scanner',
          endpoint: '/products/get',
          page: 1,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          records: searchResults.items.length,
          retryCount: 0,
          errorCode: null,
          errorMessage: null,
        });

        return result;
      } else {
        // No results found
        const errorMsg = `No product found for barcode: ${barcode}`;
        const result: ScanResult = {
          success: false,
          error: errorMsg,
          cached: false,
          timestamp,
        };

        // Cache the error result for a shorter time (5 seconds) to prevent hammering
        scanCache.set(cacheKey, {
          result,
          expiresAt: now + 5 * 1000,
        });

        // Log failed scan
        await logSyncApiRequest({
          storeId,
          module: 'scanner',
          endpoint: '/products/get',
          page: 1,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          records: 0,
          retryCount: 0,
          errorCode: 'NOT_FOUND',
          errorMessage: errorMsg,
        });

        return result;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error during barcode scan';
      const result: ScanResult = {
        success: false,
        error: errorMsg,
        cached: false,
        timestamp,
      };

      // Cache error result briefly
      scanCache.set(cacheKey, {
        result,
        expiresAt: now + 5 * 1000,
      });

      // Log error
      await logSyncApiRequest({
        storeId,
        module: 'scanner',
        endpoint: '/products/get',
        page: 1,
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        records: 0,
        retryCount: 0,
        errorCode: 'SCAN_ERROR',
        errorMessage: errorMsg,
      });

      return result;
    }
  },
  DEBOUNCE_DELAY_MS
);

/**
 * Clear the scan cache (useful for testing or when store credentials change)
 */
export function clearScanCache() {
  scanCache.clear();
}

/**
 * Get cache statistics for monitoring
 */
export function getScanCacheStats() {
  cleanCache();
  return {
    size: scanCache.size,
    ttlMs: SCAN_CACHE_TTL_MS,
    debounceDelayMs: DEBOUNCE_DELAY_MS,
  };
}

export default {
  handleBarcodeScan,
  clearScanCache,
  getScanCacheStats,
};