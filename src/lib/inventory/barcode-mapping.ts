import { createAdminClient } from '@/lib/supabase/admin';

export interface CalculatedStock {
  masterSku: string;
  physicalQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  safetyStockQuantity: number;
  availableStock: number;
}

export function calculateAvailableStock(stock: {
  physicalQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  safetyStockQuantity: number;
}): number {
  const physical = Math.max(0, stock.physicalQuantity || 0);
  const reserved = Math.max(0, stock.reservedQuantity || 0);
  const damaged = Math.max(0, stock.damagedQuantity || 0);
  const safety = Math.max(0, stock.safetyStockQuantity || 0);
  return Math.max(0, physical - (reserved + damaged + safety));
}

export async function resolveMasterSkuByBarcode(
  barcode: string,
  storeId?: string,
  sellerSku?: string
): Promise<{ masterSkuId: string | null; masterSku: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from('barcode_mappings').select('master_sku_id, master_skus(master_sku)').eq('barcode', barcode);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }
  if (sellerSku) {
    query = query.eq('seller_sku', sellerSku);
  }

  const { data } = await query.maybeSingle();

  if (data && data.master_sku_id) {
    const mSku = (data.master_skus as any)?.master_sku || null;
    return { masterSkuId: data.master_sku_id, masterSku: mSku };
  }

  return { masterSkuId: null, masterSku: null };
}

export async function linkBarcodeToMasterSku(
  barcode: string,
  masterSkuId: string,
  storeId: string,
  sellerSku: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('barcode_mappings').upsert(
    {
      barcode,
      master_sku_id: masterSkuId,
      store_id: storeId,
      seller_sku: sellerSku,
    },
    { onConflict: 'barcode,store_id,seller_sku' }
  );

  return !error;
}
