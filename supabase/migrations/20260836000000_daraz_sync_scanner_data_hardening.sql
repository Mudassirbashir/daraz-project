-- ==============================================================================
-- DARAZ SYNC SCANNER DATA HARDENING & STORE-AWARE CONSTRAINTS
-- Migration: 20260836000000_daraz_sync_scanner_data_hardening.sql
-- ==============================================================================
-- Ensures all 12 core scanner fields are present across public order and product tables
-- and establishes store-scoped composite indexes to support fast, collision-free scanning.
-- Core Required Data Fields:
--   1. Daraz Order ID (orders.daraz_order_id, order_items.daraz_order_id)
--   2. Daraz Order Item ID (order_items.order_item_id)
--   3. seller SKU (order_items.seller_sku, listings.seller_sku, daraz_product_skus.seller_sku)
--   4. SKU (order_items.sku, inventory.sku)
--   5. barcode (order_items.barcode, daraz_product_skus.barcode, listings.barcode, inventory.barcode)
--   6. Daraz Product ID (order_items.product_id, order_items.item_id, daraz_products.daraz_item_id)
--   7. Daraz SKU ID (order_items.daraz_sku_id, daraz_product_skus.daraz_sku_id)
--   8. product name (order_items.name, daraz_products.title, listings.title)
--   9. quantity (order_items.quantity, listings.stock_quantity, inventory.quantity_on_hand)
--  10. order status (orders.status, order_items.status)
--  11. tracking number (orders.tracking_number, order_items.tracking_code)
--  12. store_id (store-scoped across all tables)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: ENSURE COLUMNS ON public.order_items
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS daraz_sku_id VARCHAR(100);

-- Backfill sku column from seller_sku where missing
UPDATE public.order_items
SET sku = seller_sku
WHERE sku IS NULL AND seller_sku IS NOT NULL;

-- ------------------------------------------------------------------------------
-- SECTION 2: ENSURE STORE SCOPING & FOREIGN KEYS
-- ------------------------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.store_id IS NULL;

-- ------------------------------------------------------------------------------
-- SECTION 3: STORE-SCOPED UNIQUE INDEXES FOR IDEMPOTENT UPSERTS
-- ------------------------------------------------------------------------------
-- 3a. Unique order per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

-- 3b. Unique order item per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- 3c. Unique product per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

-- 3d. Unique product SKU per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

-- 3e. Unique listing seller SKU per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

-- 3f. Unique inventory SKU per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

-- ------------------------------------------------------------------------------
-- SECTION 4: LOOKUP INDEXES FOR FAST SCANNER RESOLUTION
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_store_sku
  ON public.order_items (store_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_store_barcode
  ON public.order_items (store_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_store_daraz_sku_id
  ON public.order_items (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_store_seller_sku
  ON public.order_items (store_id, seller_sku)
  WHERE seller_sku IS NOT NULL;
