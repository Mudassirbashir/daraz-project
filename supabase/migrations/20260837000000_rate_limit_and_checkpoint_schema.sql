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
