-- ==============================================================================
-- COMBINED DARAZ SYSTEM MIGRATION (20260807000000 to 20260902000000)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Migration: 20260807000000_add_product_images_and_details_to_listings.sql
-- ------------------------------------------------------------------------------
-- Migration: Add product images, category, brand, status, description, attributes, variations, product_url to listings
ALTER TABLE listings 
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_url TEXT;

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);


-- ------------------------------------------------------------------------------
-- Migration: 20260807000001_add_packing_and_label_printing_tracking_to_orders.sql
-- ------------------------------------------------------------------------------
-- Migration: Add packing and official shipping label print tracking to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_packed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS packed_by TEXT,
  ADD COLUMN IF NOT EXISTS is_label_printed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_printed_by TEXT,
  ADD COLUMN IF NOT EXISTS reprint_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_is_packed ON orders(is_packed);
CREATE INDEX IF NOT EXISTS idx_orders_is_label_printed ON orders(is_label_printed);


-- ------------------------------------------------------------------------------
-- Migration: 20260813000000_order_workflow_and_audit_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - EXTENDED WORKFLOW & DATA INTEGRITY
-- Migration: 20260813000000_order_workflow_and_audit_schema.sql
-- ==============================================================================

-- 1. Extend orders table with exact raw customer, shipping, and financial fields
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_province VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_district VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_area VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_landmark VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_postcode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS customer_notes TEXT,
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS package_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_provider VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR',
  ADD COLUMN IF NOT EXISTS shipping_fee_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voucher_discount_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_discount_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daraz_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daraz_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_orders_workflow_status ON orders(workflow_status);
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);

-- 2. Create order_items table for itemized product tracking
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(50) NOT NULL,
  order_item_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  seller_sku VARCHAR(100) NOT NULL,
  shop_sku VARCHAR(100),
  item_id VARCHAR(100),
  product_id VARCHAR(100),
  variation VARCHAR(100),
  quantity INT NOT NULL DEFAULT 1,
  picked_quantity INT NOT NULL DEFAULT 0,
  is_picked BOOLEAN NOT NULL DEFAULT FALSE,
  item_price_cents BIGINT NOT NULL DEFAULT 0,
  paid_price_cents BIGINT NOT NULL DEFAULT 0,
  discount_cents BIGINT NOT NULL DEFAULT 0,
  product_main_image TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  shipment_provider VARCHAR(100),
  tracking_code VARCHAR(100),
  reason TEXT,
  raw_item_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_order_item UNIQUE (order_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_daraz_order_id ON order_items(daraz_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_sku ON order_items(seller_sku);

-- 3. Create order_activities table for complete status transition audit history
CREATE TABLE IF NOT EXISTS order_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(50) NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  actor VARCHAR(100) NOT NULL DEFAULT 'System',
  source VARCHAR(50) NOT NULL DEFAULT 'Daraz Sync',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_activities_order_id ON order_activities(order_id);
CREATE INDEX IF NOT EXISTS idx_order_activities_created_at ON order_activities(created_at DESC);

-- 4. Create audit_logs table for system data audit trails
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  actor_name VARCHAR(100) NOT NULL DEFAULT 'System',
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  changes JSONB DEFAULT '{}'::jsonb,
  source VARCHAR(50) DEFAULT 'local',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 5. Create sync_retry_queue table for resilient error center & retry management
CREATE TABLE IF NOT EXISTS sync_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES daraz_stores(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  attempt_count INT NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ,
  error_message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'failed',
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_retry_queue_status ON sync_retry_queue(status, next_retry_at);

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_retry_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view order items" ON order_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Ops Manager & Admin manage order items" ON order_items FOR ALL TO authenticated USING (TRUE);

CREATE POLICY "Team can view order activities" ON order_activities FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Team can create order activities" ON order_activities FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Team can view audit logs" ON audit_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Team can create audit logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "Team can view sync retry queue" ON sync_retry_queue FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Team can manage sync retry queue" ON sync_retry_queue FOR ALL TO authenticated USING (TRUE);


-- ------------------------------------------------------------------------------
-- Migration: 20260814000000_performance_indexes.sql
-- ------------------------------------------------------------------------------
-- Migration: Performance Indexes for Daraz Operations Management
-- Description: Adds composite and single-column indexes for fast filtering and sorting across orders, listings, order_items, and audit logs.

CREATE INDEX IF NOT EXISTS idx_orders_status_order_date ON public.orders (status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders (store_id);
CREATE INDEX IF NOT EXISTS idx_orders_daraz_order_id ON public.orders (daraz_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_city ON public.orders (customer_city);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders (tracking_number);

CREATE INDEX IF NOT EXISTS idx_listings_store_id ON public.listings (store_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller_sku ON public.listings (seller_sku);
CREATE INDEX IF NOT EXISTS idx_listings_stock_quantity ON public.listings (stock_quantity);
CREATE INDEX IF NOT EXISTS idx_listings_is_synced ON public.listings (is_synced);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_sku ON public.order_items (seller_sku);

CREATE INDEX IF NOT EXISTS idx_order_activities_order_id ON public.order_activities (order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_api_logs_store_id ON public.daraz_api_logs (store_id);
CREATE INDEX IF NOT EXISTS idx_sync_retry_queue_status ON public.sync_retry_queue (status);


-- ------------------------------------------------------------------------------
-- Migration: 20260815000000_user_store_isolation_and_reconciliation.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - USER STORE ISOLATION & RECONCILIATION
-- Migration: 20260815000000_user_store_isolation_and_reconciliation.sql
-- ==============================================================================

-- 1. Add user_id column to daraz_stores for multi-tenant isolation
ALTER TABLE daraz_stores
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_daraz_stores_user_id ON daraz_stores(user_id);

-- 2. Create reconciliation_logs table for tracking data mismatches detected between Daraz API and local DB
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'product', 'inventory', 'order', 'finance'
  entity_id VARCHAR(100) NOT NULL,
  daraz_value JSONB DEFAULT '{}'::jsonb,
  local_value JSONB DEFAULT '{}'::jsonb,
  discrepancy_details TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'mismatch_detected', -- 'mismatch_detected', 'auto_reconciled', 'manually_resolved'
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_store ON reconciliation_logs(store_id, entity_type, status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_created ON reconciliation_logs(created_at DESC);

-- 3. Row Level Security Policies for reconciliation_logs
ALTER TABLE reconciliation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can view reconciliation logs" ON reconciliation_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Team can manage reconciliation logs" ON reconciliation_logs FOR ALL TO authenticated USING (TRUE);


-- ------------------------------------------------------------------------------
-- Migration: 20260816000000_add_last_sync_error_column.sql
-- ------------------------------------------------------------------------------
-- Migration: Add last_sync_error column to daraz_stores
ALTER TABLE daraz_stores
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;


-- ------------------------------------------------------------------------------
-- Migration: 20260817000000_add_daraz_webhook_events_table.sql
-- ------------------------------------------------------------------------------
-- Migration: Add daraz_webhook_events table for real-time Daraz Push Notifications
CREATE TABLE IF NOT EXISTS public.daraz_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
    seller_id TEXT,
    message_type TEXT NOT NULL,
    event_id TEXT,
    daraz_order_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'received',
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to enforce idempotency on event_id when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_webhook_events_unique_event 
ON public.daraz_webhook_events(event_id) 
WHERE event_id IS NOT NULL;

-- Index for fast store and order query lookups
CREATE INDEX IF NOT EXISTS idx_daraz_webhook_events_store_order 
ON public.daraz_webhook_events(store_id, daraz_order_id);

-- Enable RLS
ALTER TABLE public.daraz_webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on daraz_webhook_events"
ON public.daraz_webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ------------------------------------------------------------------------------
-- Migration: 20260818000001_store_slot_system_fix.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - STORE SLOT SYSTEM FIX
-- Migration: 20260818000001_store_slot_system_fix.sql
-- ==============================================================================

-- 1. Add slot_number column to daraz_stores for deterministic lowest-available slot allocation
ALTER TABLE public.daraz_stores 
  ADD COLUMN IF NOT EXISTS slot_number INTEGER;

-- 2. Safely backfill existing active stores with slot numbers (1, 2, 3...) based on created_at ordering
WITH active_stores AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as calc_slot
  FROM public.daraz_stores
  WHERE is_active = true AND slot_number IS NULL
)
UPDATE public.daraz_stores s
SET slot_number = a.calc_slot
FROM active_stores a
WHERE s.id = a.id;

-- 3. Create partial unique index to guarantee no two active stores ever share the same slot_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_stores_active_slot_unique 
  ON public.daraz_stores (slot_number) 
  WHERE (is_active = true AND slot_number IS NOT NULL);

-- 4. Create standard index for active store slot queries
CREATE INDEX IF NOT EXISTS idx_daraz_stores_active_slot 
  ON public.daraz_stores (is_active, slot_number);


-- ------------------------------------------------------------------------------
-- Migration: 20260819000000_ensure_daraz_stores_columns.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - ENSURE DARAZ STORES COLUMNS
-- Migration: 20260819000000_ensure_daraz_stores_columns.sql
-- ==============================================================================

-- Idempotently ensure all expected columns exist on daraz_stores
ALTER TABLE public.daraz_stores
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS slot_number INTEGER;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_daraz_stores_user_id ON public.daraz_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_daraz_stores_active_slot ON public.daraz_stores(is_active, slot_number);


-- ------------------------------------------------------------------------------
-- Migration: 20260820000000_sanitize_store_names.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - STORE NAME SANITIZATION
-- Migration: 20260820000000_sanitize_store_names.sql
-- Description: Updates existing daraz_stores store_name values to generic "Store 1", "Store 2", "Store 3" identifiers based on slot_number.
-- ==============================================================================

UPDATE public.daraz_stores
SET store_name = 'Store ' || COALESCE(slot_number, 1)
WHERE store_name IS NULL OR store_name NOT LIKE 'Store %';


-- ------------------------------------------------------------------------------
-- Migration: 20260821000000_ensure_orders_packing_columns.sql
-- ------------------------------------------------------------------------------
-- Ensure orders packing and label printing tracking columns exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_packed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_label_printed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_printed_by TEXT,
  ADD COLUMN IF NOT EXISTS reprint_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_is_packed ON orders(is_packed);
CREATE INDEX IF NOT EXISTS idx_orders_is_label_printed ON orders(is_label_printed);


-- ------------------------------------------------------------------------------
-- Migration: 20260822000000_create_packages_and_shipping_labels_tables.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - PACKAGES & SHIPPING LABELS SCHEMA
-- Migration: 20260822000000_create_packages_and_shipping_labels_tables.sql
-- ==============================================================================

-- 1. Create daraz_packages table
CREATE TABLE IF NOT EXISTS daraz_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(100) NOT NULL,
  package_id VARCHAR(100) NOT NULL,
  tracking_number VARCHAR(100),
  shipment_provider VARCHAR(100),
  package_status VARCHAR(50) DEFAULT 'packed',
  item_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_packages_order_id ON daraz_packages(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_packages_daraz_order_id ON daraz_packages(daraz_order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_packages_package_id ON daraz_packages(package_id);

-- 2. Create shipping_labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(100) NOT NULL,
  package_id VARCHAR(100),
  doc_type VARCHAR(50) DEFAULT 'shipping_label',
  mime_type VARCHAR(50) DEFAULT 'application/pdf',
  file_content TEXT NOT NULL,
  is_official BOOLEAN DEFAULT true,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  printed_count INT DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  last_printed_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_daraz_order_id ON shipping_labels(daraz_order_id);

-- 3. Create compatibility views for relational alignment
CREATE OR REPLACE VIEW daraz_orders AS SELECT * FROM orders;
CREATE OR REPLACE VIEW daraz_order_items AS SELECT * FROM order_items;


-- ------------------------------------------------------------------------------
-- Migration: 20260823000000_create_daraz_shipments_and_labels_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - DARAZ SHIPMENTS & LABELS SCHEMA
-- Migration: 20260823000000_create_daraz_shipments_and_labels_schema.sql
-- ==============================================================================

-- 1. Create normalized daraz_shipments table
CREATE TABLE IF NOT EXISTS daraz_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(100) NOT NULL,
  package_id VARCHAR(100),
  shipment_provider_id VARCHAR(100),
  shipment_provider_name VARCHAR(100),
  tracking_number VARCHAR(100),
  awb_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'packed',
  raw_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_shipments_store_id ON daraz_shipments(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_shipments_order_id ON daraz_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_shipments_daraz_order_id ON daraz_shipments(daraz_order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_shipments_package_id ON daraz_shipments(package_id);

-- 2. Create normalized daraz_shipping_labels table
CREATE TABLE IF NOT EXISTS daraz_shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES daraz_shipments(id) ON DELETE SET NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  daraz_order_id VARCHAR(100) NOT NULL,
  label_type VARCHAR(50) DEFAULT 'shipping_label',
  document_url TEXT,
  document_data TEXT,
  mime_type VARCHAR(50) DEFAULT 'application/pdf',
  status VARCHAR(50) DEFAULT 'ready',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_shipping_labels_shipment_id ON daraz_shipping_labels(shipment_id);
CREATE INDEX IF NOT EXISTS idx_daraz_shipping_labels_order_id ON daraz_shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_shipping_labels_daraz_order_id ON daraz_shipping_labels(daraz_order_id);

-- 3. Compatibility views for backward compatibility
CREATE OR REPLACE VIEW daraz_orders AS SELECT * FROM orders;
CREATE OR REPLACE VIEW daraz_order_items AS SELECT * FROM order_items;


-- ------------------------------------------------------------------------------
-- Migration: 20260824000000_create_daraz_products_and_skus_normalized_schema.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- Migration: 20260825000000_pipeline_hardening_and_sync_runs.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - PIPELINE HARDENING & SYNC RUNS SCHEMA
-- Migration: 20260825000000_pipeline_hardening_and_sync_runs.sql
-- ==============================================================================

-- 1. Create sync_runs table for structured diagnostic execution logs (Phase 7 Requirement)
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES daraz_stores(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual_sync', -- oauth_initial / manual_sync / refresh_products / repair_sync / cron_sync
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
  reconciliation_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_store_id ON sync_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_created_at ON sync_runs(created_at DESC);

-- 2. Add store_id to inventory table for strict multi-store isolation (Phase 4 Requirement)
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES daraz_stores(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quantity_reserved INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_synced BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on (store_id, sku) in inventory
CREATE INDEX IF NOT EXISTS idx_inventory_store_sku ON inventory(store_id, sku);

-- 3. Ensure RLS policies on sync_runs
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view sync runs" ON sync_runs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Ops Manager & Admin manage sync runs" ON sync_runs FOR ALL TO authenticated USING (TRUE);


-- ------------------------------------------------------------------------------
-- Migration: 20260826000000_multi_store_inventory_and_sync_runs.sql
-- ------------------------------------------------------------------------------
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



-- ------------------------------------------------------------------------------
-- Migration: 20260827000000_fix_daraz_store_locks_and_schema.sql
-- ------------------------------------------------------------------------------
-- 1. Add atomic token refresh lock and store slots
ALTER TABLE public.daraz_stores 
ADD COLUMN IF NOT EXISTS slot_index INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS token_refresh_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_stores_user_slot 
ON public.daraz_stores (user_id, slot_index) 
WHERE account_status != 'deleted';

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_daraz_orders_store_status ON public.daraz_orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_store ON public.daraz_order_items (store_id, order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_skus_store_sku ON public.daraz_skus (store_id, seller_sku);

-- 3. Idempotent Webhook Events Table
CREATE TABLE IF NOT EXISTS public.daraz_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  trade_order_id TEXT,
  payload JSONB NOT NULL,
  processed_status TEXT DEFAULT 'pending' CHECK (processed_status IN ('pending', 'processed', 'failed', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_store_event_id UNIQUE (store_id, event_id)
);

-- 4. RLS Security Policies
ALTER TABLE public.daraz_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_skus ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_store_owner(lookup_store_id UUID)
RETURNS BOOLEAN AS $$   SELECT EXISTS (     SELECT 1 FROM public.daraz_stores     WHERE id = lookup_store_id AND user_id = auth.uid()   ); $$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "User Store Access" ON public.daraz_stores;
CREATE POLICY "User Store Access" ON public.daraz_stores
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Store Orders Access" ON public.daraz_orders;
CREATE POLICY "Store Orders Access" ON public.daraz_orders
FOR ALL TO authenticated USING (is_store_owner(store_id)) WITH CHECK (is_store_owner(store_id));


-- ------------------------------------------------------------------------------
-- Migration: 20260828000000_central_inventory_ledger_and_barcodes.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- Migration: 20260829000000_create_daraz_apps_and_oauth_states.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ MULTI-STORE OAUTH & APP CREDENTIAL ARCHITECTURE
-- Migration: 20260829000000_create_daraz_apps_and_oauth_states.sql
-- ==============================================================================

-- 1. Create daraz_apps table for user-managed Daraz Open Platform application credentials
CREATE TABLE IF NOT EXISTS public.daraz_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL,
  encrypted_app_secret TEXT NOT NULL,
  redirect_uri TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure index on user_id & app_key
CREATE INDEX IF NOT EXISTS idx_daraz_apps_user_id ON public.daraz_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_daraz_apps_app_key ON public.daraz_apps(app_key);

-- 2. Create daraz_oauth_states table for secure server-side state tracking
CREATE TABLE IF NOT EXISTS public.daraz_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  daraz_app_id UUID REFERENCES public.daraz_apps(id) ON DELETE CASCADE,
  store_username TEXT,
  reconnect_store_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index state for O(1) lookup
CREATE INDEX IF NOT EXISTS idx_daraz_oauth_states_lookup ON public.daraz_oauth_states(state, expires_at) WHERE used_at IS NULL;

-- 3. Idempotently add columns to daraz_stores
ALTER TABLE public.daraz_stores
  ADD COLUMN IF NOT EXISTS daraz_app_id UUID REFERENCES public.daraz_apps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_username TEXT,
  ADD COLUMN IF NOT EXISTS authorization_status TEXT DEFAULT 'authorized';

-- Index daraz_app_id on daraz_stores
CREATE INDEX IF NOT EXISTS idx_daraz_stores_app_id ON public.daraz_stores(daraz_app_id);

-- 4. Enable Row Level Security
ALTER TABLE public.daraz_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daraz_apps
DROP POLICY IF EXISTS "Users can manage their own Daraz apps" ON public.daraz_apps;
CREATE POLICY "Users can manage their own Daraz apps" ON public.daraz_apps
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for daraz_oauth_states
DROP POLICY IF EXISTS "Users can access their own OAuth states" ON public.daraz_oauth_states;
CREATE POLICY "Users can access their own OAuth states" ON public.daraz_oauth_states
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260830000000_fix_daraz_stores_column_lengths.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- FIX DARAZ STORES COLUMN LENGTH CONSTRAINTS
-- Migration: 20260830000000_fix_daraz_stores_column_lengths.sql
-- ==============================================================================

-- Alter VARCHAR(100) columns on public.daraz_stores to TEXT to accommodate
-- AES-256-GCM encrypted secret payloads (~160+ chars) and long store/seller names.

ALTER TABLE public.daraz_stores
  ALTER COLUMN api_app_secret TYPE TEXT,
  ALTER COLUMN api_app_key TYPE TEXT,
  ALTER COLUMN store_name TYPE TEXT,
  ALTER COLUMN store_code TYPE TEXT,
  ALTER COLUMN seller_id TYPE TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260831000000_add_unique_constraints_for_sync_upserts.sql
-- ------------------------------------------------------------------------------
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

-- 6. Ensure store_id column exists on public.order_items before creating index
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.store_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260832000000_fix_multi_store_sync_constraints.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- Migration: 20260833000000_create_daraz_sync_settings_and_runs.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ SYNC SETTINGS & STAGED SYNC RUNS SCHEMA
-- Migration: 20260833000000_create_daraz_sync_settings_and_runs.sql
-- ==============================================================================

-- 1. Create public.daraz_sync_settings table
CREATE TABLE IF NOT EXISTS public.daraz_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daraz_stores(id) ON DELETE CASCADE UNIQUE,
  orders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  order_items_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  products_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  inventory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  active_items_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  product_images_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shipping_labels_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  addresses_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phone_numbers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  historical_orders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-store lookup performance
CREATE INDEX IF NOT EXISTS idx_daraz_sync_settings_store_id
  ON public.daraz_sync_settings (store_id);

-- 2. Create public.sync_runs table
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed', 'skipped')),
  records_fetched INT NOT NULL DEFAULT 0,
  records_inserted INT NOT NULL DEFAULT 0,
  records_updated INT NOT NULL DEFAULT 0,
  records_failed INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for per-store and per-module tracking queries
CREATE INDEX IF NOT EXISTS idx_sync_runs_store_module
  ON public.sync_runs (store_id, module_name, started_at DESC);

-- Enable RLS
ALTER TABLE public.daraz_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for authenticated service clients
CREATE POLICY "Allow service role full access to daraz_sync_settings"
  ON public.daraz_sync_settings FOR ALL USING (true);

CREATE POLICY "Allow service role full access to sync_runs"
  ON public.sync_runs FOR ALL USING (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260834000000_add_product_skus_enabled_to_daraz_sync_settings.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- ADD PRODUCT_SKUS_ENABLED COLUMN TO DARAZ_SYNC_SETTINGS
-- Migration: 20260834000000_add_product_skus_enabled_to_daraz_sync_settings.sql
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daraz_sync_settings' AND column_name = 'product_skus_enabled'
  ) THEN
    ALTER TABLE public.daraz_sync_settings
      ADD COLUMN product_skus_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260835000000_reliable_multi_store_order_scanning_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ MULTI-STORE ORDER SCANNING SCHEMA HARDENING & LOOKUP INDEXES
-- Migration: 20260835000000_reliable_multi_store_order_scanning_schema.sql
-- ==============================================================================
-- Description:
-- Establishes full store-scoping across all order and product tables and adds
-- required composite indexes to support fast, collision-free multi-store scanning
-- by 9 key lookup identifiers:
--   1. store_id
--   2. daraz_order_id
--   3. daraz_order_item_id / order_item_id
--   4. seller_sku
--   5. sku
--   6. barcode
--   7. tracking_number
--   8. daraz_product_id (daraz_item_id)
--   9. daraz_sku_id
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: ENSURE STORE SCOPING ON ALL ORDER-RELATED TABLES (Requirement A)
-- ------------------------------------------------------------------------------

-- 1a. Add store_id to public.order_items if missing and backfill from parent orders
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_items oi
SET store_id = o.store_id
FROM public.orders o
WHERE oi.order_id = o.id AND oi.store_id IS NULL;

-- 1b. Add store_id to public.daraz_packages if missing and backfill from parent orders
ALTER TABLE public.daraz_packages
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.daraz_packages p
SET store_id = o.store_id
FROM public.orders o
WHERE p.order_id = o.id AND p.store_id IS NULL;

-- 1c. Add store_id to public.shipping_labels if missing and backfill from parent orders
ALTER TABLE public.shipping_labels
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.shipping_labels sl
SET store_id = o.store_id
FROM public.orders o
WHERE sl.order_id = o.id AND sl.store_id IS NULL;

-- 1d. Add store_id to public.daraz_shipping_labels if missing and backfill from parent orders
ALTER TABLE public.daraz_shipping_labels
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.daraz_shipping_labels dsl
SET store_id = o.store_id
FROM public.orders o
WHERE dsl.order_id = o.id AND dsl.store_id IS NULL;

-- 1e. Add store_id to public.order_activities if missing and backfill from parent orders
ALTER TABLE public.order_activities
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE;

UPDATE public.order_activities oa
SET store_id = o.store_id
FROM public.orders o
WHERE oa.order_id = o.id AND oa.store_id IS NULL;


-- ------------------------------------------------------------------------------
-- SECTION 2: ADD MISSING LOOKUP COLUMNS FOR PRODUCT / ITEM SCANNING
-- ------------------------------------------------------------------------------

-- 2a. Add barcode and daraz_sku_id to public.order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS daraz_sku_id VARCHAR(100);

-- 2b. Add barcode to public.daraz_product_skus
ALTER TABLE public.daraz_product_skus
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- 2c. Add barcode to public.inventory
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- 2d. Add barcode to public.listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);


-- ------------------------------------------------------------------------------
-- SECTION 3: DUPLICATE CONFLICT DETECTION & REPORTING (Requirement J)
-- ------------------------------------------------------------------------------
-- Detect any existing data conflicts for proposed UNIQUE constraints before
-- ensuring composite UNIQUE indexes. Reports conflicts via WARNING.

DO $$
DECLARE
  v_orders_conflicts INT := 0;
  v_order_items_conflicts INT := 0;
  v_listings_conflicts INT := 0;
  v_inventory_conflicts INT := 0;
  v_products_conflicts INT := 0;
  v_skus_conflicts INT := 0;
  v_shipments_conflicts INT := 0;
BEGIN
  -- Audit orders (store_id, daraz_order_id)
  SELECT COUNT(*) INTO v_orders_conflicts FROM (
    SELECT store_id, daraz_order_id FROM public.orders
    WHERE store_id IS NOT NULL AND daraz_order_id IS NOT NULL
    GROUP BY store_id, daraz_order_id HAVING COUNT(*) > 1
  ) c;
  IF v_orders_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_order_id) key(s) found in public.orders!', v_orders_conflicts;
  END IF;

  -- Audit order_items (store_id, order_item_id)
  SELECT COUNT(*) INTO v_order_items_conflicts FROM (
    SELECT store_id, order_item_id FROM public.order_items
    WHERE store_id IS NOT NULL AND order_item_id IS NOT NULL
    GROUP BY store_id, order_item_id HAVING COUNT(*) > 1
  ) c;
  IF v_order_items_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, order_item_id) key(s) found in public.order_items!', v_order_items_conflicts;
  END IF;

  -- Audit listings (store_id, seller_sku)
  SELECT COUNT(*) INTO v_listings_conflicts FROM (
    SELECT store_id, seller_sku FROM public.listings
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
    GROUP BY store_id, seller_sku HAVING COUNT(*) > 1
  ) c;
  IF v_listings_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, seller_sku) key(s) found in public.listings!', v_listings_conflicts;
  END IF;

  -- Audit inventory (store_id, sku)
  SELECT COUNT(*) INTO v_inventory_conflicts FROM (
    SELECT store_id, sku FROM public.inventory
    WHERE store_id IS NOT NULL AND sku IS NOT NULL
    GROUP BY store_id, sku HAVING COUNT(*) > 1
  ) c;
  IF v_inventory_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, sku) key(s) found in public.inventory!', v_inventory_conflicts;
  END IF;

  -- Audit daraz_products (store_id, daraz_item_id)
  SELECT COUNT(*) INTO v_products_conflicts FROM (
    SELECT store_id, daraz_item_id FROM public.daraz_products
    WHERE store_id IS NOT NULL AND daraz_item_id IS NOT NULL
    GROUP BY store_id, daraz_item_id HAVING COUNT(*) > 1
  ) c;
  IF v_products_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_item_id) key(s) found in public.daraz_products!', v_products_conflicts;
  END IF;

  -- Audit daraz_product_skus (store_id, seller_sku)
  SELECT COUNT(*) INTO v_skus_conflicts FROM (
    SELECT store_id, seller_sku FROM public.daraz_product_skus
    WHERE store_id IS NOT NULL AND seller_sku IS NOT NULL
    GROUP BY store_id, seller_sku HAVING COUNT(*) > 1
  ) c;
  IF v_skus_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, seller_sku) key(s) found in public.daraz_product_skus!', v_skus_conflicts;
  END IF;

  -- Audit daraz_shipments (store_id, daraz_order_id)
  SELECT COUNT(*) INTO v_shipments_conflicts FROM (
    SELECT store_id, daraz_order_id FROM public.daraz_shipments
    WHERE store_id IS NOT NULL AND daraz_order_id IS NOT NULL
    GROUP BY store_id, daraz_order_id HAVING COUNT(*) > 1
  ) c;
  IF v_shipments_conflicts > 0 THEN
    RAISE WARNING '[CONFLICT DETECTED] % duplicate (store_id, daraz_order_id) key(s) found in public.daraz_shipments!', v_shipments_conflicts;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- SECTION 4: ENSURE COMPOSITE UNIQUE CONSTRAINTS (Requirement D, E, F)
-- ------------------------------------------------------------------------------
-- Ensures composite UNIQUE indexes exist for per-store isolation.
-- Note: barcode and seller_sku are NOT globally unique (Requirements E & F).

-- 4a. Unique order per store
-- Explanation: Ensures daraz_order_id is unique within a single store while allowing same ID across different stores.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

-- 4b. Unique order item per store
-- Explanation: Fast unique lookup of order items by store and order_item_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- 4c. Unique product per store
-- Explanation: Scopes Daraz product items to their specific store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

-- 4d. Unique product SKU per store
-- Explanation: Allows identical seller_sku values across different stores without collision (Requirement B & F).
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

-- 4e. Unique listing seller SKU per store
-- Explanation: Scopes store listing seller_sku values per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

-- 4f. Unique inventory SKU per store
-- Explanation: Scopes inventory SKUs per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

-- 4g. Unique shipment per store
-- Explanation: Scopes daraz_shipments records per store.
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_shipments_store_order_unique
  ON public.daraz_shipments (store_id, daraz_order_id);


-- ------------------------------------------------------------------------------
-- SECTION 5: COMPOSITE INDEXES FOR MULTI-STORE LOOKUP IDENTIFIERS (Requirement C)
-- ------------------------------------------------------------------------------
-- High-performance composite indexes to support all 9 order scanning lookups.

-- --- ORDERS LOOKUPS ---
-- 5a. Lookup order by (store_id, tracking_number)
-- Explanation: Enables instant store-scoped lookup when barcode scanner scans a shipping label tracking number.
CREATE INDEX IF NOT EXISTS idx_orders_store_tracking_number
  ON public.orders (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- --- ORDER ITEMS LOOKUPS ---
-- 5b. Lookup order items by (store_id, daraz_order_id)
-- Explanation: Enables quick retrieval of all line items for an order within a store context.
CREATE INDEX IF NOT EXISTS idx_order_items_store_daraz_order_id
  ON public.order_items (store_id, daraz_order_id);

-- 5c. Lookup order items by (store_id, seller_sku)
-- Explanation: Fast lookup of scanned items during packing verification by seller_sku.
CREATE INDEX IF NOT EXISTS idx_order_items_store_seller_sku
  ON public.order_items (store_id, seller_sku)
  WHERE seller_sku IS NOT NULL;

-- 5d. Lookup order items by (store_id, tracking_code)
-- Explanation: Enables item matching by shipping label tracking code during scanning.
CREATE INDEX IF NOT EXISTS idx_order_items_store_tracking_code
  ON public.order_items (store_id, tracking_code)
  WHERE tracking_code IS NOT NULL;

-- 5e. Lookup order items by (store_id, barcode)
-- Explanation: Enables item lookup directly by physical product barcode scanned during order packing.
CREATE INDEX IF NOT EXISTS idx_order_items_store_barcode
  ON public.order_items (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5f. Lookup order items by (store_id, daraz_sku_id)
-- Explanation: Fast order item resolution when scanning Daraz SKU identifiers.
CREATE INDEX IF NOT EXISTS idx_order_items_store_daraz_sku_id
  ON public.order_items (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5g. Lookup order items by (store_id, item_id [daraz_product_id])
-- Explanation: Fast order item resolution by Daraz product ID.
CREATE INDEX IF NOT EXISTS idx_order_items_store_item_id
  ON public.order_items (store_id, item_id)
  WHERE item_id IS NOT NULL;

-- --- BARCODE MAPPINGS LOOKUPS ---
-- 5h. Lookup barcode mappings by (store_id, barcode)
-- Explanation: Multi-store safe barcode lookup. Barcode is non-unique globally, resolved per store.
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_store_barcode
  ON public.barcode_mappings (store_id, barcode);

-- 5i. Lookup barcode mappings by (store_id, seller_sku)
-- Explanation: Fast mapping resolution between seller SKU and master barcode per store.
CREATE INDEX IF NOT EXISTS idx_barcode_mappings_store_seller_sku
  ON public.barcode_mappings (store_id, seller_sku)
  WHERE seller_sku IS NOT NULL;

-- --- PRODUCT SKUS & INVENTORY LOOKUPS ---
-- 5j. Lookup daraz_product_skus by (store_id, daraz_sku_id)
-- Explanation: Store-scoped lookup of SKU variations by Daraz SKU ID.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_daraz_sku_id
  ON public.daraz_product_skus (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5k. Lookup daraz_product_skus by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup for Daraz product SKUs.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_barcode
  ON public.daraz_product_skus (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5l. Lookup daraz_product_skus by (store_id, daraz_item_id)
-- Explanation: Store-scoped lookup of all SKUs belonging to a Daraz product item.
CREATE INDEX IF NOT EXISTS idx_daraz_product_skus_store_daraz_item_id
  ON public.daraz_product_skus (store_id, daraz_item_id);

-- 5m. Lookup inventory by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup for stock inventory.
CREATE INDEX IF NOT EXISTS idx_inventory_store_barcode
  ON public.inventory (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- 5n. Lookup listings by (store_id, daraz_sku_id)
-- Explanation: Store-scoped lookup of product listings by Daraz SKU ID.
CREATE INDEX IF NOT EXISTS idx_listings_store_daraz_sku_id
  ON public.listings (store_id, daraz_sku_id)
  WHERE daraz_sku_id IS NOT NULL;

-- 5o. Lookup listings by (store_id, barcode)
-- Explanation: Store-scoped barcode lookup on active store listings.
CREATE INDEX IF NOT EXISTS idx_listings_store_barcode
  ON public.listings (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- --- PACKAGES & SHIPMENTS LOOKUPS ---
-- 5p. Lookup daraz_packages by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of packages by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_daraz_order_id
  ON public.daraz_packages (store_id, daraz_order_id);

-- 5q. Lookup daraz_packages by (store_id, tracking_number)
-- Explanation: Fast store-scoped lookup of package details by tracking number.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_tracking_number
  ON public.daraz_packages (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 5r. Lookup daraz_packages by (store_id, package_id)
-- Explanation: Fast store-scoped lookup of package details by package ID.
CREATE INDEX IF NOT EXISTS idx_daraz_packages_store_package_id
  ON public.daraz_packages (store_id, package_id)
  WHERE package_id IS NOT NULL;

-- 5s. Lookup shipping_labels by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of shipping labels by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_shipping_labels_store_daraz_order_id
  ON public.shipping_labels (store_id, daraz_order_id);

-- 5t. Lookup daraz_shipments by (store_id, tracking_number)
-- Explanation: Fast store-scoped lookup of shipments by tracking number.
CREATE INDEX IF NOT EXISTS idx_daraz_shipments_store_tracking_number
  ON public.daraz_shipments (store_id, tracking_number)
  WHERE tracking_number IS NOT NULL;

-- 5u. Lookup daraz_shipping_labels by (store_id, daraz_order_id)
-- Explanation: Fast store-scoped lookup of Daraz shipping labels by Daraz order ID.
CREATE INDEX IF NOT EXISTS idx_daraz_shipping_labels_store_daraz_order_id
  ON public.daraz_shipping_labels (store_id, daraz_order_id);

-- 5v. Lookup order_activities by (store_id, order_id)
-- Explanation: Fast store-scoped lookup of order audit activity logs.
CREATE INDEX IF NOT EXISTS idx_order_activities_store_order_id
  ON public.order_activities (store_id, order_id);


-- ------------------------------------------------------------------------------
-- SECTION 6: UPDATE COMPATIBILITY VIEWS & NOTIFY POSTGREST
-- ------------------------------------------------------------------------------

-- Refresh compatibility views to include newly added columns seamlessly
CREATE OR REPLACE VIEW daraz_orders AS SELECT * FROM public.orders;
CREATE OR REPLACE VIEW daraz_order_items AS SELECT * FROM public.order_items;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260836000000_daraz_sync_scanner_data_hardening.sql
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- Migration: 20260837000000_rate_limit_and_checkpoint_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ SYNC RATE-LIMIT, CHECKPOINT & DIAGNOSTIC LOGS SCHEMA
-- Migration: 20260837000000_rate_limit_and_checkpoint_schema.sql
-- ==============================================================================

-- 1. Create public.daraz_sync_checkpoints table
CREATE TABLE IF NOT EXISTS public.daraz_sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  current_offset INT NOT NULL DEFAULT 0,
  current_page INT NOT NULL DEFAULT 1,
  page_size INT NOT NULL DEFAULT 50,
  total_records INT NOT NULL DEFAULT 0,
  last_success_offset INT NOT NULL DEFAULT 0,
  last_success_page INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  update_after TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_daraz_sync_checkpoints_store_module UNIQUE (store_id, module)
);

CREATE INDEX IF NOT EXISTS idx_daraz_sync_checkpoints_store_module
  ON public.daraz_sync_checkpoints (store_id, module);

-- 2. Create public.daraz_sync_logs table for detailed API request diagnostic logs
CREATE TABLE IF NOT EXISTS public.daraz_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  page INT NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records INT NOT NULL DEFAULT 0,
  retry_count INT NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_sync_logs_store_module
  ON public.daraz_sync_logs (store_id, module, page);

CREATE INDEX IF NOT EXISTS idx_daraz_sync_logs_created_at
  ON public.daraz_sync_logs (created_at DESC);

-- 3. Add configurable page size columns to public.daraz_sync_settings
ALTER TABLE public.daraz_sync_settings
  ADD COLUMN IF NOT EXISTS orders_page_size INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS products_page_size INT NOT NULL DEFAULT 50;

-- 4. Enable RLS and permissions
ALTER TABLE public.daraz_sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to daraz_sync_checkpoints"
  ON public.daraz_sync_checkpoints FOR ALL USING (true);

CREATE POLICY "Allow service role full access to daraz_sync_logs"
  ON public.daraz_sync_logs FOR ALL USING (true);

CREATE POLICY "Authenticated users can view sync checkpoints"
  ON public.daraz_sync_checkpoints FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view sync logs"
  ON public.daraz_sync_logs FOR SELECT TO authenticated USING (true);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260901000000_auth_rbac_and_store_credentials_security_fix.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ MULTI-STORE MANAGEMENT SYSTEM - AUTH, RBAC & DATABASE SECURITY FIX
-- Migration: 20260838000000_auth_rbac_and_store_credentials_security_fix.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE DARAZ STORE CREDENTIALS TABLE & MIGRATE SENSITIVE DATA
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.daraz_store_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  api_app_key TEXT,
  api_app_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_store_credentials_store_id ON public.daraz_store_credentials(store_id);

-- Safely migrate existing credentials from daraz_stores if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'daraz_stores' AND column_name = 'access_token'
  ) THEN
    INSERT INTO public.daraz_store_credentials (
      store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      created_at,
      updated_at
    )
    SELECT 
      id AS store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM public.daraz_stores
    WHERE access_token IS NOT NULL OR api_app_key IS NOT NULL OR api_app_secret IS NOT NULL
    ON CONFLICT (store_id) DO UPDATE SET
      api_app_key = EXCLUDED.api_app_key,
      api_app_secret = EXCLUDED.api_app_secret,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      updated_at = NOW();

    -- Drop secret columns from public.daraz_stores to prevent client access
    ALTER TABLE public.daraz_stores
      DROP COLUMN IF EXISTS api_app_key,
      DROP COLUMN IF EXISTS api_app_secret,
      DROP COLUMN IF EXISTS access_token,
      DROP COLUMN IF EXISTS refresh_token,
      DROP COLUMN IF EXISTS token_expires_at;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. BACKFILL USER ROLES & AUTOMATE PROFILES PROVISIONING
-- ------------------------------------------------------------------------------

-- Backfill user_roles table from profiles
INSERT INTO public.user_roles (user_id, role, assigned_at)
SELECT id, role, NOW()
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger to keep profiles.role in sync when user_roles is modified
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET role = NEW.role, updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- Trigger function for automatic profile & role provisioning on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role public.app_role;
  emp_id VARCHAR(30);
BEGIN
  IF NEW.raw_user_meta_data->>'role' IN ('super_admin', 'product_manager', 'ops_manager') THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  ELSE
    assigned_role := 'ops_manager'::public.app_role;
  END IF;

  emp_id := COALESCE(
    NEW.raw_user_meta_data->>'employee_id',
    'EMP-' || SUBSTRING(NEW.id::text FROM 1 FOR 6)
  );

  INSERT INTO public.profiles (
    id,
    employee_id,
    full_name,
    email,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    emp_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    assigned_role,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  INSERT INTO public.user_roles (
    user_id,
    role,
    assigned_at
  ) VALUES (
    NEW.id,
    assigned_role,
    NOW()
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. UPDATED RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  u_role app_role;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO u_role
  FROM public.user_roles
  WHERE user_id = target_user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin'::app_role THEN 1 
      WHEN 'product_manager'::app_role THEN 2 
      WHEN 'ops_manager'::app_role THEN 3 
      ELSE 4 
    END
  LIMIT 1;

  IF u_role IS NULL THEN
    SELECT role INTO u_role
    FROM public.profiles
    WHERE id = target_user_id;
  END IF;

  RETURN u_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN COALESCE(public.get_user_role(target_user_id) = 'super_admin'::app_role, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(target_user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF target_user_id IS NULL OR check_role IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = check_role
  );
END;
$function$;

-- ------------------------------------------------------------------------------
-- 4. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.daraz_store_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_api_logs ENABLE ROW LEVEL SECURITY;

-- 1. daraz_store_credentials
DROP POLICY IF EXISTS "Super admin manages store credentials" ON public.daraz_store_credentials;
CREATE POLICY "Super admin manages store credentials" ON public.daraz_store_credentials
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. daraz_stores
DROP POLICY IF EXISTS "Team can view stores" ON public.daraz_stores;
DROP POLICY IF EXISTS "User Store Access" ON public.daraz_stores;
DROP POLICY IF EXISTS "Super Admin manages stores" ON public.daraz_stores;
DROP POLICY IF EXISTS "Super Admin manages store credentials" ON public.daraz_stores;

CREATE POLICY "Team members can view stores" ON public.daraz_stores
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super Admin manages stores" ON public.daraz_stores
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. profiles
DROP POLICY IF EXISTS "Team members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin manages profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Team members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users or Super Admin can update profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) OR id = auth.uid());

CREATE POLICY "Super Admin manages profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admin manages roles" ON public.user_roles;

CREATE POLICY "Users read own roles or Super Admin reads all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super Admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. vendors
DROP POLICY IF EXISTS "Team can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Product Manager & Super Admin manage vendors" ON public.vendors;

CREATE POLICY "Team members can view vendors" ON public.vendors
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product Manager & Super Admin manage vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role));

-- 6. product_developments
DROP POLICY IF EXISTS "Team can view product developments" ON public.product_developments;
DROP POLICY IF EXISTS "Product Manager & Super Admin manage product dev" ON public.product_developments;

CREATE POLICY "Team members can view product developments" ON public.product_developments
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product Manager & Super Admin manage product dev" ON public.product_developments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role));

-- 7. inventory
DROP POLICY IF EXISTS "Team can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Ops Manager & Super Admin manage inventory" ON public.inventory;

CREATE POLICY "Team members can view inventory" ON public.inventory
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Ops Manager & Super Admin manage inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

-- 8. listings
DROP POLICY IF EXISTS "Team can view listings" ON public.listings;
DROP POLICY IF EXISTS "Product & Ops Managers manage listings" ON public.listings;

CREATE POLICY "Team members can view listings" ON public.listings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product & Ops Managers manage listings" ON public.listings
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'product_manager'::app_role) 
    OR public.has_role(auth.uid(), 'ops_manager'::app_role)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'product_manager'::app_role) 
    OR public.has_role(auth.uid(), 'ops_manager'::app_role)
  );

-- 9. orders
DROP POLICY IF EXISTS "Team can view orders" ON public.orders;
DROP POLICY IF EXISTS "Ops Manager & Super Admin update orders" ON public.orders;

CREATE POLICY "Team members can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Ops Manager & Super Admin manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

-- 10. tasks
DROP POLICY IF EXISTS "Team members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team members can create and update tasks" ON public.tasks;

CREATE POLICY "Team members can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator, Assignee or Super Admin update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Creator or Super Admin delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR created_by = auth.uid());

-- 11. financial_records
DROP POLICY IF EXISTS "Super Admin manages financial records" ON public.financial_records;

CREATE POLICY "Super Admin manages financial records" ON public.financial_records
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 12. daraz_api_logs
DROP POLICY IF EXISTS "Super Admin & Ops Manager view API logs" ON public.daraz_api_logs;

CREATE POLICY "Super Admin & Ops Manager view API logs" ON public.daraz_api_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

CREATE POLICY "Super Admin manages API logs" ON public.daraz_api_logs
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- Migration: 20260902000000_ensure_authorization_status_and_sync_schema.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================
-- DARAZ MULTI-STORE SYNC & AUTHORIZATION SCHEMA HARDENING
-- Migration: 20260902000000_ensure_authorization_status_and_sync_schema.sql
-- ==============================================================================

-- 1. Idempotently add authorization_status to public.daraz_stores
ALTER TABLE public.daraz_stores
  ADD COLUMN IF NOT EXISTS authorization_status TEXT DEFAULT 'authorized';

CREATE INDEX IF NOT EXISTS idx_daraz_stores_authorization_status 
  ON public.daraz_stores(authorization_status);

-- 2. Idempotently ensure daraz_store_credentials exists
CREATE TABLE IF NOT EXISTS public.daraz_store_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  api_app_key TEXT,
  api_app_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_store_credentials_store_id 
  ON public.daraz_store_credentials(store_id);

-- Safely migrate any legacy credential columns if they still exist on daraz_stores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'daraz_stores' AND column_name = 'access_token'
  ) THEN
    INSERT INTO public.daraz_store_credentials (
      store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      created_at,
      updated_at
    )
    SELECT 
      id AS store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM public.daraz_stores
    WHERE access_token IS NOT NULL OR api_app_key IS NOT NULL OR api_app_secret IS NOT NULL
    ON CONFLICT (store_id) DO UPDATE SET
      api_app_key = EXCLUDED.api_app_key,
      api_app_secret = EXCLUDED.api_app_secret,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      updated_at = NOW();

    ALTER TABLE public.daraz_stores
      DROP COLUMN IF EXISTS api_app_key,
      DROP COLUMN IF EXISTS api_app_secret,
      DROP COLUMN IF EXISTS access_token,
      DROP COLUMN IF EXISTS refresh_token,
      DROP COLUMN IF EXISTS token_expires_at;
  END IF;
END $$;

-- 3. Composite unique indexes for multi-store PostgREST conflict resolution
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

-- 4. Hard-enforce get_user_role(NULL) to return NULL and not ops_manager
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  u_role app_role;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO u_role
  FROM public.user_roles
  WHERE user_id = target_user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin'::app_role THEN 1 
      WHEN 'product_manager'::app_role THEN 2 
      WHEN 'ops_manager'::app_role THEN 3 
      ELSE 4 
    END
  LIMIT 1;

  IF u_role IS NULL THEN
    SELECT role INTO u_role
    FROM public.profiles
    WHERE id = target_user_id;
  END IF;

  RETURN u_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN COALESCE(public.get_user_role(target_user_id) = 'super_admin'::app_role, FALSE);
END;
$function$;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------------------------
-- REGISTER ALL APPLIED MIGRATIONS IN SCHEMA_MIGRATIONS TABLE
-- ------------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260807000000', 'add_product_images_and_details_to_listings'),
  ('20260807000001', 'add_packing_and_label_printing_tracking_to_orders'),
  ('20260813000000', 'order_workflow_and_audit_schema'),
  ('20260814000000', 'performance_indexes'),
  ('20260815000000', 'user_store_isolation_and_reconciliation'),
  ('20260816000000', 'add_last_sync_error_column'),
  ('20260817000000', 'add_daraz_webhook_events_table'),
  ('20260818000001', 'store_slot_system_fix'),
  ('20260819000000', 'ensure_daraz_stores_columns'),
  ('20260820000000', 'sanitize_store_names'),
  ('20260821000000', 'ensure_orders_packing_columns'),
  ('20260822000000', 'create_packages_and_shipping_labels_tables'),
  ('20260823000000', 'create_daraz_shipments_and_labels_schema'),
  ('20260824000000', 'create_daraz_products_and_skus_normalized_schema'),
  ('20260825000000', 'pipeline_hardening_and_sync_runs'),
  ('20260826000000', 'multi_store_inventory_and_sync_runs'),
  ('20260827000000', 'fix_daraz_store_locks_and_schema'),
  ('20260828000000', 'central_inventory_ledger_and_barcodes'),
  ('20260829000000', 'create_daraz_apps_and_oauth_states'),
  ('20260830000000', 'fix_daraz_stores_column_lengths'),
  ('20260831000000', 'add_unique_constraints_for_sync_upserts'),
  ('20260832000000', 'fix_multi_store_sync_constraints'),
  ('20260833000000', 'create_daraz_sync_settings_and_runs'),
  ('20260834000000', 'add_product_skus_enabled_to_daraz_sync_settings'),
  ('20260835000000', 'reliable_multi_store_order_scanning_schema'),
  ('20260836000000', 'daraz_sync_scanner_data_hardening'),
  ('20260837000000', 'rate_limit_and_checkpoint_schema'),
  ('20260901000000', 'auth_rbac_and_store_credentials_security_fix'),
  ('20260902000000', 'ensure_authorization_status_and_sync_schema')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
