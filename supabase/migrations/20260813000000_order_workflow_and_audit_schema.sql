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
