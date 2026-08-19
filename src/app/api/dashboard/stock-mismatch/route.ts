import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateAvailableStock } from '@/lib/inventory/barcode-mapping';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { data: listings } = await supabase
      .from('listings')
      .select('id, seller_sku, title, stock_quantity, store_id, inventory_id, daraz_stores(store_name, store_code)')
      .eq('is_synced', true);

    const { data: masterSkus } = await supabase
      .from('master_skus')
      .select('id, master_sku, physical_quantity, reserved_quantity, damaged_quantity, safety_stock_quantity');

    const masterMap = new Map<string, any>();
    (masterSkus || []).forEach((m) => masterMap.set(m.id, m));

    const mismatches: any[] = [];

    (listings || []).forEach((l) => {
      const master = l.inventory_id ? masterMap.get(l.inventory_id) : null;

      const physical = master ? master.physical_quantity : l.stock_quantity;
      const reserved = master ? master.reserved_quantity : 0;
      const damaged = master ? master.damaged_quantity : 0;
      const safety = master ? master.safety_stock_quantity : 0;

      const available = calculateAvailableStock({
        physicalQuantity: physical,
        reservedQuantity: reserved,
        damagedQuantity: damaged,
        safetyStockQuantity: safety,
      });

      const darazStock = l.stock_quantity || 0;
      const discrepancy = Math.abs(darazStock - available);

      if (discrepancy > 0 || !master) {
        mismatches.push({
          listingId: l.id,
          sellerSku: l.seller_sku,
          title: l.title,
          storeName: (l.daraz_stores as any)?.store_name || (l.daraz_stores as any)?.store_code || 'Daraz Store',
          darazStock,
          physicalStock: physical,
          reservedStock: reserved,
          calculatedAvailableStock: available,
          discrepancy,
          hasMasterSkuLinked: Boolean(master),
        });
      }
    });

    return NextResponse.json({
      success: true,
      mismatchCount: mismatches.length,
      mismatches,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch stock mismatch report.',
      },
      { status: 500 }
    );
  }
}
