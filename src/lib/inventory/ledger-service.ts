import { createAdminClient } from '@/lib/supabase/admin';
import { calculateAvailableStock } from './barcode-mapping';

export type LedgerChangeType =
  | 'INBOUND'
  | 'OUTBOUND'
  | 'ORDER_RESERVED'
  | 'ORDER_FULFILLED'
  | 'RETURN_RESTOCKED'
  | 'ADJUSTMENT'
  | 'SAFETY_BUFFER_CHANGE';

export interface RecordLedgerEntryParams {
  masterSkuId: string;
  storeId?: string;
  changeType: LedgerChangeType;
  quantityChange: number;
  referenceId?: string;
  notes?: string;
  createdBy?: string;
}

export async function recordInventoryLedgerEntry(params: RecordLedgerEntryParams): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: masterSku } = await supabase
    .from('master_skus')
    .select('id, physical_quantity, reserved_quantity, damaged_quantity, safety_stock_quantity')
    .eq('id', params.masterSkuId)
    .single();

  if (!masterSku) return false;

  const previousQty = masterSku.physical_quantity;
  let newQty = previousQty;
  let newReserved = masterSku.reserved_quantity;

  switch (params.changeType) {
    case 'INBOUND':
    case 'RETURN_RESTOCKED':
      newQty += params.quantityChange;
      break;
    case 'OUTBOUND':
      newQty = Math.max(0, newQty - params.quantityChange);
      break;
    case 'ORDER_RESERVED':
      newReserved += params.quantityChange;
      break;
    case 'ORDER_FULFILLED':
      newQty = Math.max(0, newQty - params.quantityChange);
      newReserved = Math.max(0, newReserved - params.quantityChange);
      break;
    case 'ADJUSTMENT':
      newQty = params.quantityChange;
      break;
  }

  // Update master SKU physical & reserved stock
  await supabase
    .from('master_skus')
    .update({
      physical_quantity: newQty,
      reserved_quantity: newReserved,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.masterSkuId);

  // Record ledger entry
  const { error } = await supabase.from('inventory_ledger').insert({
    master_sku_id: params.masterSkuId,
    store_id: params.storeId || null,
    change_type: params.changeType,
    quantity_change: params.quantityChange,
    previous_quantity: previousQty,
    new_quantity: newQty,
    reference_id: params.referenceId || null,
    notes: params.notes || null,
    created_by: params.createdBy || 'System',
  });

  return !error;
}

export async function reserveStockForOrder(
  sellerSku: string,
  storeId: string,
  orderId: string,
  quantity: number
): Promise<boolean> {
  const supabase = createAdminClient();

  // Find listing & matched master SKU
  const { data: listing } = await supabase
    .from('listings')
    .select('inventory_id')
    .eq('store_id', storeId)
    .eq('seller_sku', sellerSku)
    .maybeSingle();

  if (!listing || !listing.inventory_id) return false;

  const { data: masterSku } = await supabase
    .from('master_skus')
    .select('id')
    .eq('id', listing.inventory_id)
    .maybeSingle();

  if (!masterSku) return false;

  return recordInventoryLedgerEntry({
    masterSkuId: masterSku.id,
    storeId,
    changeType: 'ORDER_RESERVED',
    quantityChange: quantity,
    referenceId: orderId,
    notes: `Inventory reserved for Daraz Order ${orderId}`,
  });
}
