-- Migration: Add daraz_webhook_events table for real-time Daraz Push Notifications
CREATE TABLE IF NOT EXISTS public.daraz_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.daraz_stores(id) ON DELETE CASCADE,
    seller_id TEXT,
    message_type TEXT NOT NULL,
    event_id TEXT,
    daraz_order_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'received',
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index to enforce idempotency on event_id when provided
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_webhook_events_unique_event 
ON public.daraz_webhook_events(event_id) 
WHERE event_id IS NOT NULL;

-- Index for fast store and order query lookups
CREATE INDEX IF NOT EXISTS idx_daraz_webhook_events_store_order 
ON public.daraz_webhook_events(store_id, daraz_order_id);

-- Enable RLS
ALTER TABLE public.daraz_webhook_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on daraz_webhook_events"
ON public.daraz_webhook_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
