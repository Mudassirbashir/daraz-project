-- Migration: Add last_sync_error column to daraz_stores
ALTER TABLE daraz_stores
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
