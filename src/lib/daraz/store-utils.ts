import { createAdminClient } from '@/lib/supabase/admin';
import { DarazClient } from './client';
import { decryptSecret } from '../security/encryption';

export async function getValidStoreAccessToken(storeId: string): Promise<{ accessToken: string; client: DarazClient }> {
  const supabase = createAdminClient();
  
  // 1. Fetch store metadata
  const { data: store, error } = await supabase
    .from('daraz_stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error || !store) throw new Error(`Store not found: ${storeId}`);

  // 2. Fetch store credentials from secure daraz_store_credentials table
  const { data: creds } = await supabase
    .from('daraz_store_credentials')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  let appKey = (creds?.api_app_key || '').trim();
  let rawSecret = creds?.api_app_secret || '';
  let accessToken = creds?.access_token || '';
  let refreshToken = creds?.refresh_token || '';
  let tokenExpiresAt = creds?.token_expires_at || null;

  if ((!appKey || !rawSecret) && store.daraz_app_id) {
    const { data: appData } = await supabase
      .from('daraz_apps')
      .select('app_key, encrypted_app_secret')
      .eq('id', store.daraz_app_id)
      .maybeSingle();

    if (appData) {
      if (!appKey) appKey = (appData.app_key || '').trim();
      if (!rawSecret) rawSecret = appData.encrypted_app_secret || '';
    }
  }

  if (!appKey) appKey = (process.env.DARAZ_APP_KEY || '').trim();
  if (!rawSecret) rawSecret = process.env.DARAZ_APP_SECRET || '';

  const appSecret = (decryptSecret(rawSecret) || rawSecret).trim();

  const now = Date.now();
  const expiresAt = new Date(tokenExpiresAt || 0).getTime();
  const bufferMs = 24 * 60 * 60 * 1000; // 24-hour buffer

  if (expiresAt - now > bufferMs && accessToken) {
    const client = new DarazClient({
      appKey,
      appSecret,
      countryCode: store.country_code || store.region || 'PK',
      accessToken,
    });
    return { accessToken, client };
  }

  // Acquire DB Mutex Lock for 60s
  const lockExpiry = new Date(now + 60000).toISOString();
  const { data: locked } = await supabase
    .from('daraz_stores')
    .update({ token_refresh_locked_until: lockExpiry })
    .eq('id', storeId)
    .or(`token_refresh_locked_until.is.null,token_refresh_locked_until.lt.${new Date(now).toISOString()}`)
    .select('id')
    .single();

  if (!locked) {
    await new Promise((r) => setTimeout(r, 2500));
    const { data: refreshedCreds } = await supabase
      .from('daraz_store_credentials')
      .select('access_token')
      .eq('store_id', storeId)
      .maybeSingle();
    
    const validToken = refreshedCreds?.access_token || accessToken;
    const client = new DarazClient({
      appKey,
      appSecret,
      countryCode: store.country_code || store.region || 'PK',
      accessToken: validToken,
    });
    return { accessToken: validToken, client };
  }

  try {
    const tempClient = new DarazClient({
      appKey,
      appSecret,
      countryCode: store.country_code || store.region || 'PK',
    });

    const res: any = await tempClient.post('/auth/token/refresh', {
      refresh_token: refreshToken,
    });

    const newExpiresAt = new Date(Date.now() + res.expires_in * 1000).toISOString();
    const newRefreshExpiresAt = new Date(Date.now() + (res.refresh_expires_in || res.expires_in) * 1000).toISOString();

    // Save updated tokens into daraz_store_credentials
    await supabase
      .from('daraz_store_credentials')
      .upsert({
        store_id: storeId,
        api_app_key: appKey,
        api_app_secret: appSecret,
        access_token: res.access_token,
        refresh_token: res.refresh_token,
        token_expires_at: newExpiresAt,
        refresh_expires_at: newRefreshExpiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_id' });

    // Update store state
    await supabase
      .from('daraz_stores')
      .update({
        authorization_status: 'authorized',
        token_refresh_locked_until: null,
        last_sync_error: null,
        is_active: true,
      })
      .eq('id', storeId);

    const client = new DarazClient({
      appKey,
      appSecret,
      countryCode: store.country_code || store.region || 'PK',
      accessToken: res.access_token,
    });

    return { accessToken: res.access_token, client };
  } catch (err: any) {
    const userFriendlyError = `TOKEN_REFRESH_FAILED: ${err.message || "Your Daraz store connection has expired. Please reconnect your store via My Stores."}`;
    await supabase.from('daraz_stores').update({
      token_refresh_locked_until: null,
      sync_status: 'error',
      authorization_status: 'expired',
      last_sync_error: userFriendlyError,
    }).eq('id', storeId);
    throw new Error(userFriendlyError);
  }
}

// -----------------------------------------------------------------------------
// Display & UI Store Helpers
// -----------------------------------------------------------------------------

export interface StoreLike {
  id?: string;
  store_name?: string | null;
  store_username?: string | null;
  seller_id?: string | null;
  slot_number?: number | null;
  slot_index?: number | null;
  store_code?: string | null;
}

export function getStoreDisplayName(
  store?: StoreLike | null,
  fallbackIndex?: number
): string {
  if (!store) {
    return typeof fallbackIndex === 'number' ? `Store ${fallbackIndex + 1}` : 'Daraz Store';
  }

  if (store.store_name && store.store_name.trim()) {
    const name = store.store_name.trim();
    if (!/^Store \d+$/i.test(name)) {
      return name;
    }
  }

  if (store.store_username && store.store_username.trim()) {
    return store.store_username.trim();
  }

  if (store.store_name && store.store_name.trim()) {
    return store.store_name.trim();
  }

  if (store.seller_id && store.seller_id !== 'N/A' && !store.seller_id.startsWith('SELLER_')) {
    return `Seller ${store.seller_id}`;
  }

  if (store.store_code && store.store_code.trim()) {
    return store.store_code.trim();
  }

  const slot = store.slot_number || store.slot_index;
  if (typeof slot === 'number' && slot > 0) {
    return `Store ${slot}`;
  }

  if (typeof fallbackIndex === 'number' && fallbackIndex >= 0) {
    return `Store ${fallbackIndex + 1}`;
  }

  return 'Daraz Store';
}

export function getStoreInitials(displayName: string): string {
  if (!displayName || !displayName.trim()) return 'DS';
  const clean = displayName.trim();

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

  return 'DS';
}
