-- 1. Add atomic token refresh lock and store slots
ALTER TABLE public.daraz_stores 
ADD COLUMN IF NOT EXISTS slot_index INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS token_refresh_locked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_stores_user_slot 
ON public.daraz_stores (user_id, slot_index) 
WHERE account_status != 'deleted';

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_daraz_orders_store_status ON public.daraz_orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_store ON public.daraz_order_items (store_id, order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_skus_store_sku ON public.daraz_skus (store_id, seller_sku);

-- 3. Idempotent Webhook Events Table
CREATE TABLE IF NOT EXISTS public.daraz_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  trade_order_id TEXT,
  payload JSONB NOT NULL,
  processed_status TEXT DEFAULT 'pending' CHECK (processed_status IN ('pending', 'processed', 'failed', 'ignored')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_store_event_id UNIQUE (store_id, event_id)
);

-- 4. RLS Security Policies
ALTER TABLE public.daraz_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_skus ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_store_owner(lookup_store_id UUID)
RETURNS BOOLEAN AS $$   SELECT EXISTS (     SELECT 1 FROM public.daraz_stores     WHERE id = lookup_store_id AND user_id = auth.uid()   ); $$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "User Store Access" ON public.daraz_stores;
CREATE POLICY "User Store Access" ON public.daraz_stores
FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Store Orders Access" ON public.daraz_orders;
CREATE POLICY "Store Orders Access" ON public.daraz_orders
FOR ALL TO authenticated USING (is_store_owner(store_id)) WITH CHECK (is_store_owner(store_id));
