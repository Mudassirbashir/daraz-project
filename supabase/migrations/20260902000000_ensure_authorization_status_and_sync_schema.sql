-- ==============================================================================
-- DARAZ MULTI-STORE SYNC & AUTHORIZATION SCHEMA HARDENING
-- Migration: 20260902000000_ensure_authorization_status_and_sync_schema.sql
-- ==============================================================================

-- 1. Idempotently add authorization_status to public.daraz_stores
ALTER TABLE public.daraz_stores
  ADD COLUMN IF NOT EXISTS authorization_status TEXT DEFAULT 'authorized';

CREATE INDEX IF NOT EXISTS idx_daraz_stores_authorization_status 
  ON public.daraz_stores(authorization_status);

-- 2. Idempotently ensure daraz_store_credentials exists
CREATE TABLE IF NOT EXISTS public.daraz_store_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  api_app_key TEXT,
  api_app_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daraz_store_credentials_store_id 
  ON public.daraz_store_credentials(store_id);

-- Safely migrate any legacy credential columns if they still exist on daraz_stores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'daraz_stores' AND column_name = 'access_token'
  ) THEN
    INSERT INTO public.daraz_store_credentials (
      store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      created_at,
      updated_at
    )
    SELECT 
      id AS store_id,
      api_app_key,
      api_app_secret,
      access_token,
      refresh_token,
      token_expires_at,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM public.daraz_stores
    WHERE access_token IS NOT NULL OR api_app_key IS NOT NULL OR api_app_secret IS NOT NULL
    ON CONFLICT (store_id) DO UPDATE SET
      api_app_key = EXCLUDED.api_app_key,
      api_app_secret = EXCLUDED.api_app_secret,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      updated_at = NOW();

    ALTER TABLE public.daraz_stores
      DROP COLUMN IF EXISTS api_app_key,
      DROP COLUMN IF EXISTS api_app_secret,
      DROP COLUMN IF EXISTS access_token,
      DROP COLUMN IF EXISTS refresh_token,
      DROP COLUMN IF EXISTS token_expires_at;
  END IF;
END $$;

-- 3. Composite unique indexes for multi-store PostgREST conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_store_seller_sku_unique
  ON public.listings (store_id, seller_sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_store_sku_unique
  ON public.inventory (store_id, sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_products_store_item_unique
  ON public.daraz_products (store_id, daraz_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_product_skus_store_sku_unique
  ON public.daraz_product_skus (store_id, seller_sku);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_order_id_unique
  ON public.orders (store_id, daraz_order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_store_item_id_unique
  ON public.order_items (store_id, order_item_id);

-- 4. Hard-enforce get_user_role(NULL) to return NULL and not ops_manager
CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  u_role app_role;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO u_role
  FROM public.user_roles
  WHERE user_id = target_user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin'::app_role THEN 1 
      WHEN 'product_manager'::app_role THEN 2 
      WHEN 'ops_manager'::app_role THEN 3 
      ELSE 4 
    END
  LIMIT 1;

  IF u_role IS NULL THEN
    SELECT role INTO u_role
    FROM public.profiles
    WHERE id = target_user_id;
  END IF;

  RETURN u_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF target_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN COALESCE(public.get_user_role(target_user_id) = 'super_admin'::app_role, FALSE);
END;
$function$;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
