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

    const catalogRes: any = await client.get('/products/get', { filter: 'all', offset: '0', limit: '100' });
    const dataObj = catalogRes.data || catalogRes.result || catalogRes;
    let products: any[] = [];
    if (Array.isArray(dataObj)) products = dataObj;
    else if (Array.isArray(dataObj?.products)) products = dataObj.products;

    for (const p of products) {
      const skus = p.skus || p.Skus || [];
      for (const sku of skus) {
        const sellerSku = sku.seller_sku || sku.SellerSku;
        if (!sellerSku) continue;

        const qty = Math.max(0, parseInt(String(sku.quantity ?? sku.Quantity ?? 0), 10) || 0);
        const price = Math.round((parseFloat(String(sku.price ?? sku.Price ?? 0)) || 0) * 100);

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
