-- ==============================================================================
-- DARAZ MULTI-STORE UNIQUE CONSTRAINTS FOR POSTGREST UPSERTS
-- Migration: 20260831000000_add_unique_constraints_for_sync_upserts.sql
-- ==============================================================================

-- 1. Unique index on public.listings for (store_id, seller_sku)
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

-- 2. Unique index on public.inventory for (store_id, sku)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

-- 3. Unique index on public.daraz_products for (store_id, daraz_item_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

-- 4. Unique index on public.daraz_product_skus for (store_id, seller_sku)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

-- 5. Unique index on public.orders for (store_id, daraz_order_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

-- 6. Unique index on public.order_items for (store_id, order_item_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
