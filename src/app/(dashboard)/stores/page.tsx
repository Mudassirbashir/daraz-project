import React from "react";
import { Store, Package, ShoppingCart, Truck, AlertCircle, CheckCircle2, RefreshCw, MessageCircleWarning, Zap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { StoreOnboardingClient } from "@/components/stores/StoreOnboardingClient";
import { StoreAutoSyncTrigger } from "@/components/stores/StoreAutoSyncTrigger";
import { getStoreDisplayName, getStoreInitials } from "@/lib/daraz/store-utils";

import { safeGetUser } from "@/lib/supabase/auth-helper";

export const dynamic = "force-dynamic";

interface StoresPageProps {
  searchParams?: {
    connected?: string;
    store_id?: string;
    error?: string;
    message?: string;
  };
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const supabase = createAdminClient();
  const isConnectedSuccess = searchParams?.connected === "true";
  const redirectStoreId = searchParams?.store_id;
  const errorMessage = searchParams?.message;
  const errorCode = searchParams?.error;

  // Fetch logged in user stores
  let userStoreIds: string[] = [];
  try {
    const serverSupabase = createClient();
    const { user } = await safeGetUser(serverSupabase);
    if (user?.id) {
      const { data: userStores } = await supabase
        .from("daraz_stores")
        .select("id")
        .or(`user_id.eq.${user.id},user_id.is.null`);
      userStoreIds = (userStores || []).map((s) => s.id);
    }
  } catch (e) {
    // fallback
  }

  let storesQuery = supabase
    .from("daraz_stores")
    .select("*")
    .order("created_at", { ascending: true });

  if (userStoreIds.length > 0) {
    storesQuery = storesQuery.in("id", userStoreIds);
  }

  const { data: stores } = await storesQuery;
  const storesList = stores || [];

  // Calculate live metrics per store
  const enrichedStores = await Promise.all(
    storesList.map(async (st) => {
      // Fetch store credentials for token information
      let credentials = null;
      let tokenExpiresAt = null;
      let accessToken = null;
      let refreshToken = null;
      try {
        const { data: creds } = await supabase
          .from("daraz_store_credentials")
          .select("access_token, refresh_token, token_expires_at, updated_at")
          .eq("store_id", st.id)
          .single();
        credentials = creds;
        if (creds) {
          accessToken = creds.access_token;
          refreshToken = creds.refresh_token;
          tokenExpiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
        }
      } catch (credError) {
        // Credentials might not exist yet
      }

      const isConnected = Boolean(st.is_active && st.authorization_status !== "disconnected");

      if (!isConnected) {
        return {
          ...st,
          isConnected: false,
          productsCount: null,
          stockCount: null,
          ordersCount: null,
          inProgressOrdersCount: null,
          lastSyncedAt: null,
          credentials,
          tokenExpiresAt,
          accessToken,
          refreshToken,
        };
      }

      // Query products & stock for this store
      let parentCountFromTable: number | null = null;
      try {
        const { count } = await supabase
          .from("daraz_products")
          .select("*", { count: "exact", head: true })
          .eq("store_id", st.id);
        parentCountFromTable = count;
      } catch (e) {
        // Graceful fallback
      }

      const { data: listings } = await supabase
        .from("listings")
        .select("stock_quantity, daraz_item_id")
        .eq("store_id", st.id);

      const skusCount = (listings || []).length;
      const distinctItemIds = new Set((listings || []).map((l: any) => l.daraz_item_id).filter(Boolean)).size;
      const productsCount = (typeof parentCountFromTable === "number" && parentCountFromTable > 0)
        ? parentCountFromTable
        : (distinctItemIds > 0 ? distinctItemIds : skusCount);
      const stockCount = (listings || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

      // Query orders & in-progress orders for this store
      const [
        { count: totalOrdersCount },
        { count: inProgressCount },
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", st.id),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", st.id).in("status", ["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"]),
      ]);

      const ordersCount = totalOrdersCount || 0;
      const inProgressOrdersCount = inProgressCount || 0;

      // Query last synced log
      const { data: lastLog } = await supabase
        .from("daraz_api_logs")
        .select("created_at")
        .eq("store_id", st.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastSyncedAt = lastLog?.created_at || st.last_synced_at || st.updated_at || null;
      const updatedTime = st.updated_at ? new Date(st.updated_at).getTime() : 0;
      const isSyncing = st.sync_status === "syncing" && (Date.now() - updatedTime < 10 * 60 * 1000);

      // Calculate token status
      const tokenStatus = {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        isExpired: tokenExpiresAt ? tokenExpiresAt < new Date() : true,
        expiresIn: tokenExpiresAt ? Math.max(0, Math.floor((tokenExpiresAt.getTime() - Date.now()) / 1000)) : 0,
        expiresAt: tokenExpiresAt,
      };

      return {
        ...st,
        isConnected: true,
        isSyncing,
        productsCount,
        stockCount,
        ordersCount,
        inProgressOrdersCount,
        lastSyncedAt,
        credentials,
        tokenExpiresAt,
        accessToken,
        refreshToken,
        tokenStatus,
      };
    })
  );

  const connectedCount = enrichedStores.filter((s) => s.isConnected).length;
  const disconnectedCount = enrichedStores.filter((s) => !s.isConnected).length;
  const isMaxStoresReached = connectedCount >= 3;

  // Connection type breakdown
  const oauthCount = enrichedStores.filter(
    (s) => s.isConnected && !(s.store_code?.startsWith("ASAAN-") || false)
  ).length;
  const asaanRetailCount = enrichedStores.filter(
    (s) => s.isConnected && (s.store_code?.startsWith("ASAAN-") || false)
  ).length;

  // Token status summary
  const validTokenCount = enrichedStores.filter(
    (s) => s.isConnected && s.tokenStatus?.hasAccessToken && !s.tokenStatus?.isExpired
  ).length;
  const expiredTokenCount = enrichedStores.filter(
    (s) => s.isConnected && s.tokenStatus?.hasAccessToken && s.tokenStatus?.isExpired
  ).length;

  const syncingStore = enrichedStores.find((s) => s.sync_status === "syncing");
  const autoSyncStoreId = redirectStoreId || syncingStore?.id;

  return (
    <div className="space-y-6">
      {autoSyncStoreId && <StoreAutoSyncTrigger storeId={autoSyncStoreId} />}

      {/* Dynamic OAuth Alert Banners */}
      {isConnectedSuccess && (
        <div className="flex items-center space-x-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Daraz Store Connected Successfully! Initial product catalog and order synchronization complete.</span>
        </div>
      )}

      {errorCode && (
        <div className="flex items-start space-x-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300 text-xs font-semibold shadow-sm">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-sm">Daraz OAuth Authorization Error</span>
            <p className="font-mono text-[11px] text-red-700 dark:text-red-300">
              {errorMessage || "Store authorization could not be completed. Please click Connect New Store to retry."}
            </p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Daraz Stores</h1>
            <span className="rounded-xl bg-orange-100 dark:bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20">
              {connectedCount} / 3 Active Stores
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your connected Daraz seller accounts. Maximum 3 active stores allowed per user.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StoreOnboardingClient
            isMaxStoresReached={isMaxStoresReached}
            storeId=""
            storeName=""
            isConnected={false}
            mode="button"
          />

          <SyncNowButton />
        </div>
      </div>

      {/* Overview Status Pill */}
      <div className="flex flex-wrap items-center space-x-3 text-xs font-bold">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
          <span>🟢 Connected: {connectedCount}</span>
        </div>

        {disconnectedCount > 0 && (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span>⚪ Disconnected: {disconnectedCount}</span>
          </span>
        )}

        {/* Connection Type Breakdown */}
        {connectedCount > 0 && (
          <>
            <span className="inline-flex items-center space-x-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
              OAuth: {oauthCount}
            </span>
            <span className="inline-flex items-center space-x-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20">
              Asaan Retail: {asaanRetailCount}
            </span>
          </>
        )}

        {/* Token Status Summary */}
        {connectedCount > 0 && (
          <>
            <span className="inline-flex items-center space-x-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/20">
              Valid Tokens: {validTokenCount}
            </span>
            {expiredTokenCount > 0 && (
              <span className="inline-flex items-center space-x-2 rounded-xl bg-red-50 dark:bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
                Expired Tokens: {expiredTokenCount}
              </span>
            )}
          </>
        )}
      </div>

      {/* Stores Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {enrichedStores.map((store, idx) => {
          const storeName = getStoreDisplayName(store, idx);
          const initials = getStoreInitials(storeName);

          const hasSyncError = Boolean(store.last_sync_error || store.sync_status === "error");
          const isAsaanRetailStyle = store.store_code?.startsWith("ASAAN-") || false;

          return (
            <div
              key={store.id}
              className={`rounded-3xl border p-6 space-y-5 transition-all duration-200 shadow-apple hover:shadow-apple-hover ${
                store.isConnected
                  ? "border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl"
                  : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50 opacity-90"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white font-extrabold flex items-center justify-center text-base shadow-md shadow-orange-500/20 shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                        {storeName}
                      </h3>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {store.isConnected ? "Active" : "Disconnected"}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {store.isConnected && store.seller_id && store.seller_id !== "N/A" ? `Seller ID: ${store.seller_id}` : "Disconnected Slot"}
                    </p>
                  </div>
                </div>

                {/* Connection & Sync Status Badge */}
                <div className="flex items-center space-x-2">
                  {store.isConnected ? (
                    store.isSyncing ? (
                      <span className="inline-flex items-center space-x-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
                        <span>Syncing...</span>
                      </span>
                    ) : store.last_sync_error || store.sync_status === "error" ? (
                      <span className="inline-flex items-center space-x-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                        <span>Sync Notice</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20 shrink-0">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span>Connected</span>
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      <span>Disconnected</span>
                    </span>
                  )}

                  {/* Connection Type Badge */}
                  {store.isConnected && (
                    <span className="ml-2 inline-flex items-center space-x-1 rounded-xl bg-orange-50 dark:bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20">
                      {isAsaanRetailStyle ? "Asaan Retail" : "OAuth"}
                    </span>
                  )}
                </div>
              </div>

              {/* Sync Error Alert Banner */}
              {hasSyncError && (
                <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-xs">
                      {store.sync_status === "error" ? "Store Sync Failure" : "Store Sync Notice"}
                    </span>
                    <span className="text-[10px] font-mono block leading-relaxed">{store.last_sync_error || "Please verify Daraz API connection credentials."}</span>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-3 pt-1">
                {/* 1. Products */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Package className="h-3 w-3 text-blue-500" />
                    <span>Products</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected
                      ? store.productsCount
                      : "--"}
                  </p>
                </div>

                {/* 2. Stock */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Store className="h-3 w-3 text-purple-500" />
                    <span>Stock</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected
                      ? store.stockCount
                      : "--"}
                  </p>
                </div>

                {/* 3. Orders */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <ShoppingCart className="h-3 w-3 text-emerald-500" />
                    <span>Orders</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected
                      ? store.ordersCount
                      : "--"}
                  </p>
                </div>

                {/* 4. Token Status */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <RefreshCw className="h-3 w-3 text-indigo-500" />
                    <span>Token</span>
                  </span>
                  {store.isConnected ? (
                    <>
                      {store.tokenStatus.hasAccessToken ? (
                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                          {store.tokenStatus.isExpired ? "EXPIRED" : "VALID"}
                        </p>
                      ) : (
                        <p className="mt-1 text-lg font-bold text-slate-500 dark:text-slate-400">
                          MISSING
                        </p>
                      )}
                      {!store.tokenStatus.hasAccessToken && store.tokenStatus.hasRefreshToken && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Refresh available
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-lg font-bold text-slate-500 dark:text-slate-400">
                      --
                    </p>
                  )}
                </div>
              </div>

              {/* Orders In Progress row / Info message */}
              {store.isConnected ? (
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-1 font-semibold">
                    <Truck className="h-3.5 w-3.5 text-orange-500" />
                    <span>Orders in Progress:</span>
                  </span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                    {store.inProgressOrdersCount}
                  </span>
                </div>
              ) : (
                <p className="text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 py-1">
                  Connect this store to see live products, stock, and orders.
                </p>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <StoreOnboardingClient
                  isMaxStoresReached={isMaxStoresReached}
                  storeId={store.id}
                  storeName={storeName}
                  isConnected={store.isConnected}
                  mode="card_actions"
                />
              </div>

              {/* Footer Info */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  {store.isConnected ? (
                    <>
                      <span className="text-slate-500 dark:text-slate-400">
                        Last synced:
                      </span>
                      <span className="font-medium">
                        {store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString() : "Recently"}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      Not connected
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {store.isConnected ? (
                    <>
                      {store.tokenStatus.hasAccessToken ? (
                        <>
                          <span className="text-slate-500 dark:text-slate-400">
                            Token:
                          </span>
                          <span className="font-medium {store.tokenStatus.isExpired ? 'text-red-500' : 'text-green-500'}">
                            {store.tokenStatus.isExpired ? 'Expired' : 'Valid'}
                          </span>
                          {!store.tokenStatus.isExpired && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                              ({Math.floor(store.tokenStatus.expiresIn / 3600)}h {Math.floor((store.tokenStatus.expiresIn % 3600) / 60)}m left)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500 dark:text-slate-400">
                            Token:
                          </span>
                          <span className="font-medium text-red-500">
                            Missing
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      --
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
