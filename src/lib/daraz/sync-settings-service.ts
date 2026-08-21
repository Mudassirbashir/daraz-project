import { createAdminClient } from "@/lib/supabase/admin";

export interface DarazStoreSyncSettings {
  id?: string;
  store_id: string;
  // Core Operational Data (Enabled by default)
  orders_enabled: boolean;        // Order ID, tracking number
  order_items_enabled: boolean;   // Order item ID, line items
  products_enabled: boolean;      // Products catalog
  product_skus_enabled: boolean;  // SKU, seller SKU, barcode
  inventory_enabled: boolean;     // Inventory/stock levels
  active_items_enabled: boolean;  // Active seller center items

  // Configurable Page Sizes
  orders_page_size?: number;      // Default: 100
  products_page_size?: number;    // Default: 50

  // Optional Heavy Data (Disabled by default)
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
  orders_page_size: 100,
  products_page_size: 50,
  product_images_enabled: false,
  shipping_labels_enabled: false,
  addresses_enabled: false,
  phone_numbers_enabled: false,
  historical_orders_enabled: false,
};

export const GLOBAL_DEFAULT_STORE_ID = "global_default";

/**
 * Required operational fields for scanner functionality (Picking, Packing, Order Scanning).
 * These fields cannot be disabled by users because warehouse operations depend on them.
 */
export const REQUIRED_OPERATIONAL_FIELDS: (keyof Omit<DarazStoreSyncSettings, "id" | "store_id" | "updated_at">)[] = [
  "orders_enabled",
  "order_items_enabled",
  "products_enabled",
  "product_skus_enabled",
];

/**
 * Ensures scanner-required operational fields (Order ID, Order Item ID, SKU, Seller SKU, Barcode, Tracking Number)
 * cannot be set to false, protecting warehouse picking/packing scanner functionality.
 */
export function sanitizeSyncSettings<T extends Partial<Omit<DarazStoreSyncSettings, "store_id" | "id">>>(
  settings: T
): T {
  return {
    ...settings,
    orders_enabled: true,
    order_items_enabled: true,
    products_enabled: true,
    product_skus_enabled: true,
  };
}

/**
 * Retrieves global default sync settings for newly connected stores.
 */
export async function getGlobalSyncSettings(): Promise<DarazStoreSyncSettings> {
  const supabase = createAdminClient();

  try {
    const { data } = await supabase
      .from("daraz_sync_settings")
      .select("*")
      .eq("store_id", GLOBAL_DEFAULT_STORE_ID)
      .maybeSingle();

    if (data) {
      return sanitizeSyncSettings({
        ...DEFAULT_SYNC_SETTINGS,
        ...data,
      }) as DarazStoreSyncSettings;
    }
  } catch (err: any) {
    console.warn(`[Sync Settings Service] Global query notice: ${err?.message}`);
  }

  return {
    store_id: GLOBAL_DEFAULT_STORE_ID,
    ...DEFAULT_SYNC_SETTINGS,
  };
}

/**
 * Updates global default sync settings.
 */
export async function updateGlobalSyncSettings(
  settings: Partial<Omit<DarazStoreSyncSettings, "store_id" | "id">>
): Promise<DarazStoreSyncSettings> {
  return updateStoreSyncSettings(GLOBAL_DEFAULT_STORE_ID, settings);
}

/**
 * Retrieves per-store sync settings from database or returns inherited global defaults.
 */
export async function getStoreSyncSettings(storeId: string): Promise<DarazStoreSyncSettings> {
  if (storeId === GLOBAL_DEFAULT_STORE_ID) {
    return getGlobalSyncSettings();
  }

  const supabase = createAdminClient();

  try {
    const { data } = await supabase
      .from("daraz_sync_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    if (data) {
      return sanitizeSyncSettings({
        ...DEFAULT_SYNC_SETTINGS,
        ...data,
        store_id: storeId,
      }) as DarazStoreSyncSettings;
    }
  } catch (err: any) {
    console.warn(`[Sync Settings Service] Query notice for store_id=${storeId}: ${err?.message}`);
  }

  // Fallback to global defaults if configured
  const globalDefaults = await getGlobalSyncSettings();

  return sanitizeSyncSettings({
    ...globalDefaults,
    store_id: storeId,
  }) as DarazStoreSyncSettings;
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

  const updatedPayload = sanitizeSyncSettings({
    ...current,
    ...settings,
    store_id: storeId,
    updated_at: new Date().toISOString(),
  });

  try {
    const { data, error } = await supabase
      .from("daraz_sync_settings")
      .upsert(updatedPayload, { onConflict: "store_id" })
      .select()
      .single();

    if (error) {
      console.error(`[Sync Settings Service] Upsert error: ${error.message}`);
      return updatedPayload as DarazStoreSyncSettings;
    }

    return sanitizeSyncSettings(data) as DarazStoreSyncSettings;
  } catch (err: any) {
    console.error(`[Sync Settings Service] Exception: ${err?.message}`);
    return updatedPayload as DarazStoreSyncSettings;
  }
}

