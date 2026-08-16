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
