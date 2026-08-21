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
