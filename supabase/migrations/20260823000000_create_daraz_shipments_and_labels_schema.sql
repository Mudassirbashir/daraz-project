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
