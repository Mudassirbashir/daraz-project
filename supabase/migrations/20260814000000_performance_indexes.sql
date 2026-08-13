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
