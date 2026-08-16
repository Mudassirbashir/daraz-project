-- Ensure orders packing and label printing tracking columns exist
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_packed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_label_printed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label_printed_by TEXT,
  ADD COLUMN IF NOT EXISTS reprint_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_is_packed ON orders(is_packed);
CREATE INDEX IF NOT EXISTS idx_orders_is_label_printed ON orders(is_label_printed);
