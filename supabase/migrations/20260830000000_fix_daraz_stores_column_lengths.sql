-- ==============================================================================
-- FIX DARAZ STORES COLUMN LENGTH CONSTRAINTS
-- Migration: 20260830000000_fix_daraz_stores_column_lengths.sql
-- ==============================================================================

-- Alter VARCHAR(100) columns on public.daraz_stores to TEXT to accommodate
-- AES-256-GCM encrypted secret payloads (~160+ chars) and long store/seller names.

ALTER TABLE public.daraz_stores
  ALTER COLUMN api_app_secret TYPE TEXT,
  ALTER COLUMN api_app_key TYPE TEXT,
  ALTER COLUMN store_name TYPE TEXT,
  ALTER COLUMN store_code TYPE TEXT,
  ALTER COLUMN seller_id TYPE TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
