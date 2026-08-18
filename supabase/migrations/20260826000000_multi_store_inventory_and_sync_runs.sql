-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - MULTI-STORE INVENTORY & SYNC RUNS HARDENING
-- Migration: 20260826000000_multi_store_inventory_and_sync_runs.sql
-- ==============================================================================

-- 1. Create normalized daraz_products table (Parent Items) if not exists
CREATE TABLE IF NOT EXISTS daraz_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  daraz_item_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  category VARCHAR(255) DEFAULT 'General',
  brand VARCHAR(255) DEFAULT 'Generic',
  status VARCHAR(50) DEFAULT 'active',
  description TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  attributes JSONB DEFAULT '{}'::jsonb,
  product_url TEXT,
  skus_count INT DEFAULT 0,
  total_stock INT DEFAULT 0,
  is_synced BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_daraz_item_per_store UNIQUE (store_id, daraz_item_id)
);

CREATE INDEX IF NOT EXISTS idx_daraz_products_store_id ON daraz_products(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_products_daraz_item_id ON daraz_products(daraz_item_id);

-- 2. Create normalized daraz_product_skus table (SKU Variations) if not exists
CREATE TABLE IF NOT EXISTS daraz_product_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES daraz_products(id) ON DELETE CASCADE,
  daraz_item_id VARCHAR(100) NOT NULL,
  daraz_sku_id VARCHAR(100),
  seller_sku VARCHAR(100) NOT NULL,
  shop_sku VARCHAR(100),
  price_cents BIGINT NOT NULL DEFAULT 0,
  special_price_cents BIGINT,
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  images JSONB DEFAULT '[]'::jsonb,
  package_content TEXT,
  is_synced BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_seller_sku_per_store_skus UNIQUE (store_id, seller_sku)
);

CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_id ON daraz_product_skus(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_seller_sku ON daraz_product_skus(seller_sku);

-- 3. Create sync_runs table for structured diagnostic execution logs
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual_sync',
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- in_progress / completed / completed_with_errors / failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms BIGINT DEFAULT 0,
  products_pages_fetched INT DEFAULT 0,
  parent_items_fetched INT DEFAULT 0,
  skus_fetched INT DEFAULT 0,
  orders_fetched INT DEFAULT 0,
  order_items_fetched INT DEFAULT 0,
  rows_inserted INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  rows_marked_stale INT DEFAULT 0,
  rows_skipped_invalid INT DEFAULT 0,
  api_request_ids JSONB DEFAULT '[]'::jsonb,
  sanitized_errors JSONB DEFAULT '[]'::jsonb,
  module_results JSONB DEFAULT '{}'::jsonb,
  reconciliation_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_store_id ON sync_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);

-- 4. Multi-Store Inventory Schema Hardening
-- Step 4a: Add store_id and quantity_reserved to inventory safely
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES daraz_stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quantity_reserved INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- Step 4b: Backfill store_id on inventory using existing listings relationships
UPDATE public.inventory i
SET store_id = l.store_id
FROM public.listings l
WHERE i.sku = l.seller_sku AND i.store_id IS NULL;

-- Step 4c: Drop old global unique constraint on sku if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory'::regclass AND conname = 'inventory_sku_key'
  ) THEN
    ALTER TABLE public.inventory DROP CONSTRAINT inventory_sku_key;
  END IF;
END $$;

-- Step 4d: Create composite unique constraint UNIQUE (store_id, sku) for upsert conflict resolution
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory'::regclass AND conname = 'unique_inventory_store_sku'
  ) THEN
    ALTER TABLE public.inventory ADD CONSTRAINT unique_inventory_store_sku UNIQUE (store_id, sku);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_store_sku ON public.inventory(store_id, sku);

-- 5. Add reserved_quantity to listings table for direct projection
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0;

-- 6. Create order_items table for normalized order line items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  daraz_order_id TEXT NOT NULL,
  order_item_id TEXT NOT NULL,
  name TEXT,
  seller_sku TEXT,
  shop_sku TEXT,
  item_id TEXT,
  product_id TEXT,
  quantity INTEGER DEFAULT 1,
  item_price_cents BIGINT DEFAULT 0,
  paid_price_cents BIGINT DEFAULT 0,
  status TEXT,
  shipment_provider TEXT,
  tracking_code TEXT,
  product_main_image TEXT,
  raw_item_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_order_item_per_order UNIQUE (order_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_sku ON public.order_items(seller_sku);

