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
