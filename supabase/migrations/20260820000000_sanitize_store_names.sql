-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - STORE NAME SANITIZATION
-- Migration: 20260820000000_sanitize_store_names.sql
-- Description: Updates existing daraz_stores store_name values to generic "Store 1", "Store 2", "Store 3" identifiers based on slot_number.
-- ==============================================================================

UPDATE public.daraz_stores
SET store_name = 'Store ' || COALESCE(slot_number, 1)
WHERE store_name IS NULL OR store_name NOT LIKE 'Store %';
