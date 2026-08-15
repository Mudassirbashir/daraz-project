-- Migration: Add slot_number to daraz_stores for dynamic store slot reuse
ALTER TABLE public.daraz_stores ADD COLUMN IF NOT EXISTS slot_number INTEGER;

-- Index for fast active store slot ordering
CREATE INDEX IF NOT EXISTS idx_daraz_stores_active_slot ON public.daraz_stores(is_active, slot_number);
