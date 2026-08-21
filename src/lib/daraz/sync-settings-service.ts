import { createAdminClient } from "@/lib/supabase/admin";

export interface DarazStoreSyncSettings {
  id?: string;
  store_id: string;
  orders_enabled: boolean;
  order_items_enabled: boolean;
  products_enabled: boolean;
  product_skus_enabled: boolean;
  inventory_enabled: boolean;
  active_items_enabled: boolean;
  product_images_enabled: boolean;
  shipping_labels_enabled: boolean;
  addresses_enabled: boolean;
  phone_numbers_enabled: boolean;
  historical_orders_enabled: boolean;
  updated_at?: string;
}

export const DEFAULT_SYNC_SETTINGS: Omit<DarazStoreSyncSettings, "store_id"> = {
  orders_enabled: true,
  order_items_enabled: true,
  products_enabled: true,
  product_skus_enabled: true,
  inventory_enabled: true,
  active_items_enabled: true,
  product_images_enabled: false,
  shipping_labels_enabled: false,
  addresses_enabled: false,
  phone_numbers_enabled: false,
  historical_orders_enabled: false,
};

/**
 * Retrieves per-store sync settings from database or returns safe defaults.
 */
export async function getStoreSyncSettings(storeId: string): Promise<DarazStoreSyncSettings> {
  const supabase = createAdminClient();

  try {
    const { data } = await supabase
      .from("daraz_sync_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    if (data) {
      return data as DarazStoreSyncSettings;
    }
  } catch (err: any) {
    console.warn(`[Sync Settings Service] Query notice for store_id=${storeId}: ${err?.message}`);
  }

  return {
    store_id: storeId,
    ...DEFAULT_SYNC_SETTINGS,
  };
}

/**
 * Updates or persists per-store sync configuration.
 */
export async function updateStoreSyncSettings(
  storeId: string,
  settings: Partial<Omit<DarazStoreSyncSettings, "store_id" | "id">>
): Promise<DarazStoreSyncSettings> {
  const supabase = createAdminClient();
  const current = await getStoreSyncSettings(storeId);

  const updatedPayload = {
    ...current,
    ...settings,
    store_id: storeId,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("daraz_sync_settings")
      .upsert(updatedPayload, { onConflict: "store_id" })
      .select()
      .single();

    if (error) {
      console.error(`[Sync Settings Service] Upsert error: ${error.message}`);
      return updatedPayload;
    }

    return data as DarazStoreSyncSettings;
  } catch (err: any) {
    console.error(`[Sync Settings Service] Exception: ${err?.message}`);
    return updatedPayload;
  }
}
