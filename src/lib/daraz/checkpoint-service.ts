import { createAdminClient } from '../supabase/admin';

export interface DarazSyncCheckpoint {
  id?: string;
  store_id: string;
  module: string;
  current_offset: number;
  current_page: number;
  page_size: number;
  total_records: number;
  last_success_offset: number;
  last_success_page: number;
  status: 'in_progress' | 'completed' | 'failed';
  update_after?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/**
 * Retrieves existing checkpoint for a given store and module.
 */
export async function getSyncCheckpoint(
  storeId: string,
  moduleName: string
): Promise<DarazSyncCheckpoint | null> {
  const supabase = createAdminClient();
  try {
    const { data, error } = await supabase
      .from('daraz_sync_checkpoints')
      .select('*')
      .eq('store_id', storeId)
      .eq('module', moduleName)
      .maybeSingle();

    if (error) {
      console.warn(`[CheckpointService] Notice getting checkpoint for store ${storeId} module ${moduleName}: ${error.message}`);
      return null;
    }

    return data as DarazSyncCheckpoint | null;
  } catch (err: any) {
    console.warn(`[CheckpointService] Exception getting checkpoint: ${err?.message}`);
    return null;
  }
}

/**
 * Upserts sync progress checkpoint for a store module.
 */
export async function saveSyncCheckpoint(
  checkpoint: Omit<DarazSyncCheckpoint, 'id' | 'created_at'>
): Promise<void> {
  const supabase = createAdminClient();
  const timestamp = new Date().toISOString();

  const payload = {
    ...checkpoint,
    updated_at: timestamp,
  };

  try {
    const { error } = await supabase
      .from('daraz_sync_checkpoints')
      .upsert(payload, { onConflict: 'store_id,module' });

    if (error) {
      console.error(`[CheckpointService] Upsert error for store ${checkpoint.store_id} module ${checkpoint.module}: ${error.message}`);
    }
  } catch (err: any) {
    console.error(`[CheckpointService] Exception saving checkpoint: ${err?.message}`);
  }
}

/**
 * Resets or removes checkpoint when a module sync is fully completed.
 */
export async function clearSyncCheckpoint(
  storeId: string,
  moduleName: string
): Promise<void> {
  const supabase = createAdminClient();
  try {
    await supabase
      .from('daraz_sync_checkpoints')
      .delete()
      .eq('store_id', storeId)
      .eq('module', moduleName);
  } catch (err: any) {
    console.warn(`[CheckpointService] Exception clearing checkpoint: ${err?.message}`);
  }
}
