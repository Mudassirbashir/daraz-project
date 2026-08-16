/**
 * Store Naming & Display Utilities
 * Standardizes all store names across ERP UI to generic identifiers (Store 1, Store 2, Store 3).
 */

export interface StoreLike {
  id?: string;
  store_name?: string | null;
  slot_number?: number | null;
  store_code?: string | null;
}

/**
 * Returns a standardized, generic display name for a Daraz store ("Store 1", "Store 2", "Store 3").
 */
export function getStoreDisplayName(
  store?: StoreLike | null,
  fallbackIndex?: number
): string {
  if (!store) {
    return typeof fallbackIndex === "number" ? `Store ${fallbackIndex + 1}` : "Store 1";
  }

  // 1. If store has an explicit slot_number (1, 2, 3...)
  if (typeof store.slot_number === "number" && store.slot_number > 0) {
    return `Store ${store.slot_number}`;
  }

  // 2. If fallbackIndex is provided (0-indexed position from list)
  if (typeof fallbackIndex === "number" && fallbackIndex >= 0) {
    return `Store ${fallbackIndex + 1}`;
  }

  // 3. Check if store_name already matches "Store N"
  if (store.store_name && /^Store \d+$/i.test(store.store_name.trim())) {
    const match = store.store_name.match(/\d+/);
    if (match) {
      return `Store ${match[0]}`;
    }
  }

  // 4. Default fallback
  return "Store 1";
}

/**
 * Returns a 2-character badge initial (e.g. "S1", "S2", "S3", "DS") for a store display name.
 */
export function getStoreInitials(displayName: string): string {
  const match = displayName.match(/\d+/);
  if (match) {
    return `S${match[0]}`;
  }
  return "DS";
}
