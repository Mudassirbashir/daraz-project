-- ==============================================================================
-- ADD PRODUCT_SKUS_ENABLED COLUMN TO DARAZ_SYNC_SETTINGS
-- Migration: 20260834000000_add_product_skus_enabled_to_daraz_sync_settings.sql
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daraz_sync_settings' AND column_name = 'product_skus_enabled'
  ) THEN
    ALTER TABLE public.daraz_sync_settings
      ADD COLUMN product_skus_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
