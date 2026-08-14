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
