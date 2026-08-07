import React from "react";
import { Store, CheckCircle2, AlertCircle, RefreshCw, Plus, Package, ShoppingCart, Truck, ExternalLink, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { SyncNowButton } from "@/components/common/SyncNowButton";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const supabase = createAdminClient();

  // Fetch all configured stores from Supabase
  const { data: stores } = await supabase
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const storesList = stores || [];

  // Calculate live metrics per store
  const enrichedStores = await Promise.all(
    storesList.map(async (st) => {
      const isConnected = Boolean(st.access_token);

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
        .select("status")
        .eq("store_id", st.id);

      const ordersCount = (orders || []).length;
      const inProgressOrdersCount = (orders || []).filter((o) =>
        ["pending", "unpaid", "ready_to_ship", "shipped"].includes(o.status)
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

      const lastSyncedAt = lastLog?.created_at || st.updated_at || null;

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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Daraz Stores</h1>
            <span className="rounded-xl bg-orange-100 dark:bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20">
              {enrichedStores.length} Stores Total
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Manage and check all your Daraz stores from one place.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <a
            href="/api/auth/daraz/login"
            title="Connect a new official Daraz seller account"
            className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press"
          >
            <Plus className="h-4 w-4" />
            <span>Connect New Store</span>
          </a>

          <SyncNowButton />
        </div>
      </div>

      {/* Overview Status Pill */}
      <div className="flex items-center space-x-3 text-xs font-bold">
        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
          <span>🟢 Connected: {connectedCount}</span>
        </span>

        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <span>⚪ Not Connected: {disconnectedCount}</span>
        </span>
      </div>

      {/* Stores Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        {enrichedStores.map((store) => {
          // Generate store initials for logo placeholder
          const initials = store.store_name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

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
                    <span>🟢 Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                    <span>⚪ Not Connected</span>
                  </span>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {/* 1. Products */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Package className="h-3 w-3 text-blue-500" />
                    <span>Products</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? store.productsCount : "--"}
                  </p>
                </div>

                {/* 2. Stock */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <Store className="h-3 w-3 text-purple-500" />
                    <span>Stock</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? store.stockCount : "--"}
                  </p>
                </div>

                {/* 3. Orders */}
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-3 text-center border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center space-x-1">
                    <ShoppingCart className="h-3 w-3 text-emerald-500" />
                    <span>Orders</span>
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {store.isConnected ? store.ordersCount : "--"}
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
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2">
                {store.isConnected ? (
                  <>
                    <a
                      href={`/listings?store_id=${store.id}`}
                      title="Open store products"
                      className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all apple-press shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      <span>Open Store</span>
                    </a>

                    <a
                      href="/api/auth/daraz/login"
                      title="Reconnect Daraz store account"
                      className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </a>
                  </>
                ) : (
                  <a
                    href="/api/auth/daraz/login"
                    title="Connect this Daraz store account"
                    className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press"
                  >
                    <Store className="h-4 w-4" />
                    <span>Connect Store</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
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
