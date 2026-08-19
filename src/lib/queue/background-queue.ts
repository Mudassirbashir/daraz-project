import { createAdminClient } from '@/lib/supabase/admin';
import { executeDarazSync } from '@/lib/daraz/sync-service';
import { pullStockForStore, pushStockToStore } from '@/lib/daraz/stock-sync';
import { getValidStoreAccessToken } from '@/lib/daraz/store-utils';

export type BackgroundQueueName = 'orders_sync' | 'products_sync' | 'inventory_push' | 'token_refresh' | 'fulfillment_push';

export interface EnqueueJobParams {
  queueName: BackgroundQueueName;
  payload: Record<string, any>;
  scheduledAt?: string;
  maxAttempts?: number;
}

export async function enqueueBackgroundJob(params: EnqueueJobParams): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('background_jobs')
    .insert({
      queue_name: params.queueName,
      payload: params.payload,
      scheduled_at: params.scheduledAt || new Date().toISOString(),
      max_attempts: params.maxAttempts || 5,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[BackgroundQueue] Failed to enqueue job:', error.message);
    return null;
  }

  return data?.id || null;
}

export async function processNextPendingJob(): Promise<{ processed: boolean; jobId?: string; queueName?: string; error?: string }> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find next pending job
  const { data: job } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return { processed: false };

  // Lock job
  await supabase.from('background_jobs').update({ status: 'processing' }).eq('id', job.id);

  try {
    const payload = job.payload || {};

    switch (job.queue_name as BackgroundQueueName) {
      case 'orders_sync':
      case 'products_sync':
        await executeDarazSync(payload.store_id);
        break;

      case 'inventory_push':
        if (payload.store_id && Array.isArray(payload.updates)) {
          await pushStockToStore(payload.store_id, payload.updates);
        }
        break;

      case 'token_refresh':
        if (payload.store_id) {
          await getValidStoreAccessToken(payload.store_id);
        }
        break;

      case 'fulfillment_push':
        if (payload.store_id) {
          await pullStockForStore(payload.store_id);
        }
        break;
    }

    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return { processed: true, jobId: job.id, queueName: job.queue_name };
  } catch (err: any) {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.max_attempts || 5;
    const isFailedFinal = attempts >= maxAttempts;

    // Exponential backoff delay: 2^attempts * 10 seconds
    const backoffSeconds = Math.pow(2, attempts) * 10;
    const nextScheduled = new Date(Date.now() + backoffSeconds * 1000).toISOString();

    await supabase
      .from('background_jobs')
      .update({
        status: isFailedFinal ? 'failed' : 'pending',
        attempts,
        last_error: err.message || String(err),
        scheduled_at: isFailedFinal ? job.scheduled_at : nextScheduled,
      })
      .eq('id', job.id);

    return { processed: true, jobId: job.id, queueName: job.queue_name, error: err.message };
  }
}
