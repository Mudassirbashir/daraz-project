-- ==============================================================================
-- DARAZ MULTI-STORE MANAGEMENT SYSTEM - AUTH, RBAC & DATABASE SECURITY FIX
-- Migration: 20260838000000_auth_rbac_and_store_credentials_security_fix.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CREATE DARAZ STORE CREDENTIALS TABLE & MIGRATE SENSITIVE DATA
-- ------------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_daraz_store_credentials_store_id ON public.daraz_store_credentials(store_id);

-- Safely migrate existing credentials from daraz_stores if columns exist
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

    -- Drop secret columns from public.daraz_stores to prevent client access
    ALTER TABLE public.daraz_stores
      DROP COLUMN IF EXISTS api_app_key,
      DROP COLUMN IF EXISTS api_app_secret,
      DROP COLUMN IF EXISTS access_token,
      DROP COLUMN IF EXISTS refresh_token,
      DROP COLUMN IF EXISTS token_expires_at;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. BACKFILL USER ROLES & AUTOMATE PROFILES PROVISIONING
-- ------------------------------------------------------------------------------

-- Backfill user_roles table from profiles
INSERT INTO public.user_roles (user_id, role, assigned_at)
SELECT id, role, NOW()
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Trigger to keep profiles.role in sync when user_roles is modified
CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET role = NEW.role, updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- Trigger function for automatic profile & role provisioning on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role public.app_role;
  emp_id VARCHAR(30);
BEGIN
  IF NEW.raw_user_meta_data->>'role' IN ('super_admin', 'product_manager', 'ops_manager') THEN
    assigned_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  ELSE
    assigned_role := 'ops_manager'::public.app_role;
  END IF;

  emp_id := COALESCE(
    NEW.raw_user_meta_data->>'employee_id',
    'EMP-' || SUBSTRING(NEW.id::text FROM 1 FOR 6)
  );

  INSERT INTO public.profiles (
    id,
    employee_id,
    full_name,
    email,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    emp_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    assigned_role,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  INSERT INTO public.user_roles (
    user_id,
    role,
    assigned_at
  ) VALUES (
    NEW.id,
    assigned_role,
    NOW()
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 3. UPDATED RBAC HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.has_role(target_user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF target_user_id IS NULL OR check_role IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = check_role
  );
END;
$function$;

-- ------------------------------------------------------------------------------
-- 4. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS across all tables
ALTER TABLE public.daraz_store_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_api_logs ENABLE ROW LEVEL SECURITY;

-- 1. daraz_store_credentials
DROP POLICY IF EXISTS "Super admin manages store credentials" ON public.daraz_store_credentials;
CREATE POLICY "Super admin manages store credentials" ON public.daraz_store_credentials
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. daraz_stores
DROP POLICY IF EXISTS "Team can view stores" ON public.daraz_stores;
DROP POLICY IF EXISTS "User Store Access" ON public.daraz_stores;
DROP POLICY IF EXISTS "Super Admin manages stores" ON public.daraz_stores;
DROP POLICY IF EXISTS "Super Admin manages store credentials" ON public.daraz_stores;

CREATE POLICY "Team members can view stores" ON public.daraz_stores
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super Admin manages stores" ON public.daraz_stores
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. profiles
DROP POLICY IF EXISTS "Team members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin manages profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Team members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users or Super Admin can update profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR id = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) OR id = auth.uid());

CREATE POLICY "Super Admin manages profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admin manages roles" ON public.user_roles;

CREATE POLICY "Users read own roles or Super Admin reads all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "Super Admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. vendors
DROP POLICY IF EXISTS "Team can view vendors" ON public.vendors;
DROP POLICY IF EXISTS "Product Manager & Super Admin manage vendors" ON public.vendors;

CREATE POLICY "Team members can view vendors" ON public.vendors
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product Manager & Super Admin manage vendors" ON public.vendors
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role));

-- 6. product_developments
DROP POLICY IF EXISTS "Team can view product developments" ON public.product_developments;
DROP POLICY IF EXISTS "Product Manager & Super Admin manage product dev" ON public.product_developments;

CREATE POLICY "Team members can view product developments" ON public.product_developments
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product Manager & Super Admin manage product dev" ON public.product_developments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'product_manager'::app_role));

-- 7. inventory
DROP POLICY IF EXISTS "Team can view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Ops Manager & Super Admin manage inventory" ON public.inventory;

CREATE POLICY "Team members can view inventory" ON public.inventory
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Ops Manager & Super Admin manage inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

-- 8. listings
DROP POLICY IF EXISTS "Team can view listings" ON public.listings;
DROP POLICY IF EXISTS "Product & Ops Managers manage listings" ON public.listings;

CREATE POLICY "Team members can view listings" ON public.listings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Product & Ops Managers manage listings" ON public.listings
  FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'product_manager'::app_role) 
    OR public.has_role(auth.uid(), 'ops_manager'::app_role)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) 
    OR public.has_role(auth.uid(), 'product_manager'::app_role) 
    OR public.has_role(auth.uid(), 'ops_manager'::app_role)
  );

-- 9. orders
DROP POLICY IF EXISTS "Team can view orders" ON public.orders;
DROP POLICY IF EXISTS "Ops Manager & Super Admin update orders" ON public.orders;

CREATE POLICY "Team members can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Ops Manager & Super Admin manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

-- 10. tasks
DROP POLICY IF EXISTS "Team members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Team members can create and update tasks" ON public.tasks;

CREATE POLICY "Team members can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Team members can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator, Assignee or Super Admin update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) OR created_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Creator or Super Admin delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR created_by = auth.uid());

-- 11. financial_records
DROP POLICY IF EXISTS "Super Admin manages financial records" ON public.financial_records;

CREATE POLICY "Super Admin manages financial records" ON public.financial_records
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 12. daraz_api_logs
DROP POLICY IF EXISTS "Super Admin & Ops Manager view API logs" ON public.daraz_api_logs;

CREATE POLICY "Super Admin & Ops Manager view API logs" ON public.daraz_api_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'ops_manager'::app_role));

CREATE POLICY "Super Admin manages API logs" ON public.daraz_api_logs
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 5. RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
