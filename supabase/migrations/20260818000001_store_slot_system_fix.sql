-- ==============================================================================
-- DARAZ OPERATIONS MANAGEMENT SYSTEM - STORE SLOT SYSTEM FIX
-- Migration: 20260818000001_store_slot_system_fix.sql
-- ==============================================================================

-- 1. Add slot_number column to daraz_stores for deterministic lowest-available slot allocation
ALTER TABLE public.daraz_stores 
  ADD COLUMN IF NOT EXISTS slot_number INTEGER;

-- 2. Safely backfill existing active stores with slot numbers (1, 2, 3...) based on created_at ordering
WITH active_stores AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as calc_slot
  FROM public.daraz_stores
  WHERE is_active = true AND slot_number IS NULL
)
UPDATE public.daraz_stores s
SET slot_number = a.calc_slot
FROM active_stores a
WHERE s.id = a.id;

-- 3. Create partial unique index to guarantee no two active stores ever share the same slot_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_stores_active_slot_unique 
  ON public.daraz_stores (slot_number) 
  WHERE (is_active = true AND slot_number IS NOT NULL);

-- 4. Create standard index for active store slot queries
CREATE INDEX IF NOT EXISTS idx_daraz_stores_active_slot 
  ON public.daraz_stores (is_active, slot_number);
