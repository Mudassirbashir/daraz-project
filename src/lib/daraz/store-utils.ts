/**
 * Store Naming & Display Utilities
 * Dynamic store naming: uses the official connected Daraz seller/store name
 * (e.g., "ISD Traders", "M Saleem Mall", "Haleema Mall").
 */

export interface StoreLike {
  id?: string;
  store_name?: string | null;
  seller_id?: string | null;
  slot_number?: number | null;
  store_code?: string | null;
}

/**
 * Returns the official display name for a Daraz store.
 * Prefers the real store_name returned by Daraz Open Platform API.
 */
export function getStoreDisplayName(
  store?: StoreLike | null,
  fallbackIndex?: number
): string {
  if (!store) {
    return typeof fallbackIndex === "number" ? `Store ${fallbackIndex + 1}` : "Daraz Store";
  }

  // 1. Prefer official store_name if present and non-empty
  if (store.store_name && store.store_name.trim()) {
    const name = store.store_name.trim();
    // If store_name is generic "Store N", check if seller_id or store_code is available
    if (/^Store \d+$/i.test(name)) {
      if (store.seller_id && store.seller_id !== "N/A" && !store.seller_id.startsWith("SELLER_")) {
        return `Seller ${store.seller_id}`;
      }
    }
    return name;
  }

  // 2. Fallback to seller_id if available
  if (store.seller_id && store.seller_id !== "N/A" && !store.seller_id.startsWith("SELLER_")) {
    return `Seller ${store.seller_id}`;
  }

  // 3. Fallback to store_code if available
  if (store.store_code && store.store_code.trim()) {
    return store.store_code.trim();
  }

  // 4. Fallback slot number
  if (typeof store.slot_number === "number" && store.slot_number > 0) {
    return `Store ${store.slot_number}`;
  }

  if (typeof fallbackIndex === "number" && fallbackIndex >= 0) {
    return `Store ${fallbackIndex + 1}`;
  }

  return "Daraz Store";
}

/**
 * Returns 2-character badge initials (e.g. "IT" for ISD Traders, "MS" for M Saleem Mall) for a store.
 */
export function getStoreInitials(displayName: string): string {
  if (!displayName || !displayName.trim()) return "DS";
  const clean = displayName.trim();

  // If match "Store N"
  const storeNumMatch = clean.match(/^Store (\d+)$/i);
  if (storeNumMatch) {
    return `S${storeNumMatch[1]}`;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  } else if (words.length === 1 && words[0].length === 1) {
    return words[0].toUpperCase();
  }

  return "DS";
}
