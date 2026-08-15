-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - STORE SLOT ALLOCATION & RECONCILIATION
-- Migration: 20260818000000_store_slot_number.sql
-- ==============================================================================

-- 1. Add slot_number column to daraz_stores for deterministic lowest-available allocation
ALTER TABLE daraz_stores
  ADD COLUMN IF NOT EXISTS slot_number INT;

CREATE INDEX IF NOT EXISTS idx_daraz_stores_slot ON daraz_stores(slot_number);
