import React from "react";
import { Store, Package, ShoppingCart, Truck, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { StoreCardActions } from "@/components/stores/StoreCardActions";

export const dynamic = "force-dynamic";

interface StoresPageProps {
  searchParams?: {
    connected?: string;
    error?: string;
    message?: string;
  };
}

export default async function StoresPage({ searchParams }: StoresPageProps) {
  const supabase = createAdminClient();
  const isConnectedSuccess = searchParams?.connected === "true";
  const errorMessage = searchParams?.message;
  const errorCode = searchParams?.error;

  // One-time automatic purge of legacy dummy/placeholder seed store rows from daraz_stores
  try {
    await supabase
      .from("daraz_stores")
      .delete()
      .in("seller_id", ["504904", "504905", "504906"]);
  } catch (e) {
    // ignore
  }

  // Fetch logged in user stores
  let userStoreIds: string[] = [];
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
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
      const isConnected = Boolean(st.access_token && st.is_active);

      if (!isConnected) {
        return {
          ...st,
          isConnected: false,
          productsCount: null,
          stockCount: null,
          ordersCount: null,
          inProgressOrdersCount: null,
          lastSyncedAt: null,
        };
      }

      // Query products & stock for this store
      const { data: listings } = await supabase
        .from("listings")
        .select("stock_quantity")
        .eq("store_id", st.id);

      const productsCount = (listings || []).length;
      const stockCount = (listings || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

      // Query orders & in-progress orders for this store
      const { data: orders } = await supabase
        .from("orders")
        .select("status, workflow_status")
        .eq("store_id", st.id);

      const ordersCount = (orders || []).length;
      const inProgressOrdersCount = (orders || []).filter((o) =>
        ["pending", "unpaid", "ready_to_ship", "shipped"].includes(o.workflow_status || o.status)
      ).length;

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

      return {
        ...st,
        isConnected: true,
        productsCount,
        stockCount,
        ordersCount,
        inProgressOrdersCount,
        lastSyncedAt,
      };
    })
  );

  const connectedCount = enrichedStores.filter((s) => s.isConnected).length;
  const disconnectedCount = enrichedStores.filter((s) => !s.isConnected).length;
  const isMaxStoresReached = enrichedStores.length >= 3;

  return (
    <div className="space-y-6">
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
              {enrichedStores.length} / 3 Stores Max
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage your connected Daraz seller accounts. Maximum 3 stores allowed per user.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isMaxStoresReached ? (
            <button
              disabled
              title="Maximum 3 Daraz stores allowed. Remove an existing store before connecting another."
              className="inline-flex items-center space-x-1.5 rounded-xl bg-slate-300 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-500 cursor-not-allowed opacity-75"
            >
              <Plus className="h-4 w-4" />
              <span>Max 3 Stores Reached</span>
            </button>
          ) : (
            <a
              href="/api/auth/daraz/login"
              title="Connect a new official Daraz seller account"
              className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press"
            >
              <Plus className="h-4 w-4" />
              <span>Connect New Store</span>
            </a>
          )}

          <SyncNowButton />
        </div>
      </div>

      {/* Overview Status Pill */}
      <div className="flex items-center space-x-3 text-xs font-bold">
        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
          <span>🟢 Connected: {connectedCount}</span>
        </span>

        {disconnectedCount > 0 && (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span>⚪ Disconnected: {disconnectedCount}</span>
          </span>
        )}
      </div>

      {/* Stores Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {enrichedStores.map((store) => {
          const initials = store.store_name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          const hasSyncError = Boolean(store.last_sync_error || store.sync_status === "error");

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
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                      {store.store_name}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      Seller ID: {store.seller_id}
                    </p>
                  </div>
                </div>

                {/* Connection Status Badge */}
                {store.isConnected ? (
                  <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    <span>Disconnected</span>
                  </span>
                )}
              </div>

              {/* Sync Error Alert Banner */}
              {hasSyncError && (
                <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px]">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-bold block">Store connected, but sync reported notice:</span>
                    <span className="text-[10px] font-mono">{store.last_sync_error || "Check API connection"}</span>
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {/* 1. Products */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Package className="h-3 w-3 text-blue-500" />
                    <span>Products</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? (hasSyncError && store.productsCount === 0 ? "Failed" : store.productsCount) : "--"}
                  </p>
                </div>

                {/* 2. Stock */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Store className="h-3 w-3 text-purple-500" />
                    <span>Stock</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? (hasSyncError && store.stockCount === 0 ? "Failed" : store.stockCount) : "--"}
                  </p>
                </div>

                {/* 3. Orders */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <ShoppingCart className="h-3 w-3 text-emerald-500" />
                    <span>Orders</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? (hasSyncError && store.ordersCount === 0 ? "Failed" : store.ordersCount) : "--"}
                  </p>
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
                <StoreCardActions
                  storeId={store.id}
                  storeName={store.store_name}
                  isConnected={store.isConnected}
                />
              </div>

              {/* Footer Last Synced */}
              {store.isConnected && (
                <p className="text-[10px] text-center text-slate-400 font-medium pt-1">
                  Last synced: {store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString() : "Recently"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
