-- ==============================================================================
-- DARAZ MULTI-STORE OAUTH & APP CREDENTIAL ARCHITECTURE
-- Migration: 20260829000000_create_daraz_apps_and_oauth_states.sql
-- ==============================================================================

-- 1. Create daraz_apps table for user-managed Daraz Open Platform application credentials
CREATE TABLE IF NOT EXISTS public.daraz_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL,
  encrypted_app_secret TEXT NOT NULL,
  redirect_uri TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure index on user_id & app_key
CREATE INDEX IF NOT EXISTS idx_daraz_apps_user_id ON public.daraz_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_daraz_apps_app_key ON public.daraz_apps(app_key);

-- 2. Create daraz_oauth_states table for secure server-side state tracking
CREATE TABLE IF NOT EXISTS public.daraz_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  daraz_app_id UUID REFERENCES public.daraz_apps(id) ON DELETE CASCADE,
  store_username TEXT,
  reconnect_store_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index state for O(1) lookup
CREATE INDEX IF NOT EXISTS idx_daraz_oauth_states_lookup ON public.daraz_oauth_states(state, expires_at) WHERE used_at IS NULL;

-- 3. Idempotently add columns to daraz_stores
ALTER TABLE public.daraz_stores
  ADD COLUMN IF NOT EXISTS daraz_app_id UUID REFERENCES public.daraz_apps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_username TEXT,
  ADD COLUMN IF NOT EXISTS authorization_status TEXT DEFAULT 'authorized';

-- Index daraz_app_id on daraz_stores
CREATE INDEX IF NOT EXISTS idx_daraz_stores_app_id ON public.daraz_stores(daraz_app_id);

-- 4. Enable Row Level Security
ALTER TABLE public.daraz_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daraz_apps
DROP POLICY IF EXISTS "Users can manage their own Daraz apps" ON public.daraz_apps;
CREATE POLICY "Users can manage their own Daraz apps" ON public.daraz_apps
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for daraz_oauth_states
DROP POLICY IF EXISTS "Users can access their own OAuth states" ON public.daraz_oauth_states;
CREATE POLICY "Users can access their own OAuth states" ON public.daraz_oauth_states
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
