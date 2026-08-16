-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - DARAZ PRODUCTS & SKUS NORMALIZED SCHEMA
-- Migration: 20260824000000_create_daraz_products_and_skus_normalized_schema.sql
-- ==============================================================================

-- 1. Create normalized daraz_products table (Parent Items)
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
CREATE INDEX IF NOT EXISTS idx_daraz_products_status ON daraz_products(status);

-- 2. Create normalized daraz_product_skus table (SKU Variations)
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
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_product_id ON daraz_product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_seller_sku ON daraz_product_skus(seller_sku);
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_daraz_item_id ON daraz_product_skus(daraz_item_id);
