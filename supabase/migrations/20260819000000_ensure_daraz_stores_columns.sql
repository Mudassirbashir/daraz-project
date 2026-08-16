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
