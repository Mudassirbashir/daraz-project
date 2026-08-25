import { DarazClient } from './client';
import { getValidStoreAccessToken } from './store-utils';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SkuUpdate {
  itemId: string | number;
  skuId?: string | number;
  sellerSku: string;
  quantity?: number;
  price?: number;
}

export function buildPriceQuantityXml(skus: SkuUpdate[]): string {
  const items = skus.map((s) => {
    let xml = `<Sku><ItemId>${s.itemId}</ItemId>`;
    if (s.skuId) xml += `<SkuId>${s.skuId}</SkuId>`;
    xml += `<SellerSku><![CDATA[${s.sellerSku}]]></SellerSku>`;
    if (s.quantity !== undefined) xml += `<Quantity>${s.quantity}</Quantity>`;
    if (s.price !== undefined) xml += `<Price>${s.price.toFixed(2)}</Price>`;
    xml += `</Sku>`;
    return xml;
  }).join('');
  return `<Request><Product><Skus>${items}</Skus></Product></Request>`;
}

export async function syncStockBatch(client: DarazClient, skus: SkuUpdate[]) {
  const CHUNK_SIZE = 20;
  const results = [];
  for (let i = 0; i < skus.length; i += CHUNK_SIZE) {
    const chunk = skus.slice(i, i + CHUNK_SIZE);
    const payload = buildPriceQuantityXml(chunk);
    const res = await client.post('/product/price_quantity/update', { payload });
    results.push(res);
    await new Promise((r) => setTimeout(r, 100)); // 100ms rate-limiting gap
  }
  return results;
}

// -----------------------------------------------------------------------------
// High-Level Store Stock Push / Pull Functions
// -----------------------------------------------------------------------------

export async function pullStockForStore(storeId: string) {
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  let skusUpdated = 0;

  try {
    const { client } = await getValidStoreAccessToken(storeId);
    const supabase = createAdminClient();

    // Get last sync timestamp for incremental updates
    const { data: lastSyncData } = await supabase
      .from('daraz_stores')
      .select('last_stock_sync_at')
      .eq('id', storeId)
      .single();

    const lastSyncTimestamp = lastSyncData?.last_stock_sync_at;
    const updateAfter = lastSyncTimestamp
      ? new Date(new Date(lastSyncTimestamp).getTime() - (24 * 60 * 60 * 1000)).toISOString() // 24h overlap
      : '2020-01-01T00:00:00Z'; // Full sync if never synced before

    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const catalogRes = await client.getCatalogItems(offset, limit, undefined, updateAfter);
      if (!catalogRes || !catalogRes.items || catalogRes.items.length === 0) {
        break;
      }

      for (const p of catalogRes.items) {
        const skus = p.skus || [];
        for (const sku of skus) {
          const sellerSku = sku.seller_sku;
          if (!sellerSku) continue;

          const qty = Math.max(0, parseInt(String(sku.quantity ?? 0), 10) || 0);
          const price = sku.price_cents || 0;

          await supabase
            .from('listings')
            .update({
              stock_quantity: qty,
              price_cents: price,
              last_synced_at: timestamp,
              is_synced: true,
            })
            .eq('store_id', storeId)
            .eq('seller_sku', sellerSku);

          skusUpdated++;
        }
      }

      offset += catalogRes.raw_items_count || catalogRes.items.length;
      if (offset >= catalogRes.total_items || catalogRes.items.length === 0) {
        hasMore = false;
      }

      // Increased throttling delay to respect rate limits
      await new Promise((r) => setTimeout(r, 300)); // 300ms between batches
    }

    // Update last stock sync timestamp
    await supabase
      .from('daraz_stores')
      .update({ last_stock_sync_at: timestamp })
      .eq('id', storeId);

    return { success: true, storeId, skusUpdated, errors, timestamp };
  } catch (err: any) {
    errors.push(err.message || String(err));
    return { success: false, storeId, skusUpdated, errors, timestamp };
  }
}

export async function pushStockToStore(
  storeId: string,
  updates: Array<{
    sellerSku: string;
    itemId?: string | number;
    skuId?: string | number;
    quantity?: number;
    priceCents?: number;
  }>
) {
  if (!updates || updates.length === 0) {
    return { success: true, pushedCount: 0, errors: [] };
  }

  try {
    const { client } = await getValidStoreAccessToken(storeId);
    const formattedUpdates: SkuUpdate[] = updates.map((u) => ({
      itemId: u.itemId || '0',
      skuId: u.skuId,
      sellerSku: u.sellerSku,
      quantity: u.quantity,
      price: typeof u.priceCents === 'number' ? u.priceCents / 100 : undefined,
    }));

    await syncStockBatch(client, formattedUpdates);

    return {
      success: true,
      pushedCount: updates.length,
      errors: [],
    };
  } catch (err: any) {
    return {
      success: false,
      pushedCount: 0,
      errors: [err.message || String(err)],
    };
  }
}
