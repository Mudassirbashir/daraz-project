-- ==============================================================================
-- DARAZ MULTI-STORE SYNC PIPELINE & UNIQUE CONSTRAINTS HARDENING
-- Migration: 20260832000000_fix_multi_store_sync_constraints.sql
-- ==============================================================================

-- 1. Ensure store_id column exists on public.order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

-- Backfill store_id on order_items from parent orders table if missing
UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.store_id IS NULL;

-- 2. Safely deduplicate records keeping the latest updated row prior to index creation

-- 2a. public.listings (store_id, seller_sku)
DELETE FROM public.listings
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, seller_sku
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.listings
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 2b. public.inventory (store_id, sku)
DELETE FROM public.inventory
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, sku
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.inventory
    WHERE store_id IS NOT NULL AND sku IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 2c. public.daraz_products (store_id, daraz_item_id)
DELETE FROM public.daraz_products
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, daraz_item_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.daraz_products
    WHERE store_id IS NOT NULL AND daraz_item_id IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 2d. public.daraz_product_skus (store_id, seller_sku)
DELETE FROM public.daraz_product_skus
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, seller_sku
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.daraz_product_skus
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 2e. public.orders (store_id, daraz_order_id)
DELETE FROM public.orders
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, daraz_order_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.orders
    WHERE store_id IS NOT NULL AND daraz_order_id IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 2f. public.order_items (store_id, order_item_id)
DELETE FROM public.order_items
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY store_id, order_item_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) as rn
    FROM public.order_items
    WHERE store_id IS NOT NULL AND order_item_id IS NOT NULL
  ) sub
  WHERE sub.rn > 1
);

-- 3. Drop obsolete single-column global unique constraints if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND conname = 'orders_daraz_order_id_key'
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_daraz_order_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass AND conname = 'inventory_sku_key'
  ) THEN
    ALTER TABLE public.inventory DROP CONSTRAINT inventory_sku_key;
  END IF;
END $$;

-- 4. Create composite UNIQUE indexes for multi-store PostgREST upsert conflict targets

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_shipments_store_order_unique
  ON public.daraz_shipments (store_id, daraz_order_id);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
