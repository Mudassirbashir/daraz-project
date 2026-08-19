-- Migration: Central Inventory Ledger, Barcode Mappings, Encrypted Credentials, and Background Jobs Queue

-- 1. Encrypted Credentials columns on daraz_stores
ALTER TABLE daraz_stores 
ADD COLUMN IF NOT EXISTS encrypted_api_app_secret TEXT,
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token TEXT;

-- 2. Master SKUs Table
CREATE TABLE IF NOT EXISTS master_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_sku TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  physical_quantity INT NOT NULL DEFAULT 0 CHECK (physical_quantity >= 0),
  reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  damaged_quantity INT NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  safety_stock_quantity INT NOT NULL DEFAULT 0 CHECK (safety_stock_quantity >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Barcode Mappings Table
CREATE TABLE IF NOT EXISTS barcode_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL,
  master_sku_id UUID NOT NULL REFERENCES master_skus(id) ON DELETE CASCADE,
  store_id UUID REFERENCES daraz_stores(id) ON DELETE CASCADE,
  seller_sku TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_barcode_store_sku UNIQUE (barcode, store_id, seller_sku)
);

-- 4. Central Inventory Ledger Table
CREATE TABLE IF NOT EXISTS inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_sku_id UUID NOT NULL REFERENCES master_skus(id) ON DELETE CASCADE,
  store_id UUID REFERENCES daraz_stores(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('INBOUND', 'OUTBOUND', 'ORDER_RESERVED', 'ORDER_FULFILLED', 'RETURN_RESTOCKED', 'ADJUSTMENT', 'SAFETY_BUFFER_CHANGE')),
  quantity_change INT NOT NULL,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  reference_id TEXT,
  notes TEXT,
  created_by TEXT DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Background Jobs Queue Table
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL CHECK (queue_name IN ('orders_sync', 'products_sync', 'inventory_push', 'token_refresh', 'fulfillment_push')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast query execution
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_barcode ON barcode_mappings(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_master_sku ON barcode_mappings(master_sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_master_sku ON inventory_ledger(master_sku_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_store ON inventory_ledger(store_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue_status ON background_jobs(queue_name, status);
