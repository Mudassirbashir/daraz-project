import React from "react";
import {
  Store,
  ShoppingCart,
  Package,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Flame,
  Plus
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeGetUser } from "@/lib/supabase/auth-helper";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { logDashboardError } from "@/lib/logging/dashboard-logger";
import { getStoreDisplayName, getStoreInitials } from "@/lib/daraz/store-utils";
import { fetchAllStoreOrders, fetchAllStoreListings } from "@/lib/supabase/fetch-all";
import { getCentralStoreMetrics } from "@/lib/supabase/central-data-service";
import { StoreOnboardingClient } from "@/components/stores/StoreOnboardingClient";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams?: {
    storeId?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let serverSupabase: ReturnType<typeof createClient> | null = null;
  let configErrorMsg: string | null = null;

  // Safe Supabase Client Initializations
  try {
    supabase = createAdminClient();
  } catch (err: any) {
    configErrorMsg = err?.message || "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured";
    logDashboardError("Dashboard Page Admin Client Init", err);
  }

  try {
    serverSupabase = createClient();
  } catch (err: any) {
    if (!configErrorMsg) {
      configErrorMsg = err?.message || "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured";
    }
    logDashboardError("Dashboard Page Server Client Init", err);
  }

  const selectedStoreId = searchParams?.storeId || "all";
  const isCombinedView = selectedStoreId === "all";

  // Fetch logged-in user profile name & authorized stores
  let userName = "Team Member";
  let userStoreIds: string[] = [];

  if (serverSupabase && supabase) {
    try {
      const safeUserRes = await safeGetUser(serverSupabase);
      const user = safeUserRes.user;

      if (safeUserRes.error && !safeUserRes.isClockSkew) {
        logDashboardError("Dashboard Page Auth Check", safeUserRes.error);
      }

      if (user?.id) {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profileErr) {
          logDashboardError("Dashboard Page Profile Query", profileErr);
        } else if (profile?.full_name) {
          userName = profile.full_name.split(" ")[0];
        } else {
          userName = user.email ? user.email.split("@")[0] : "Team Member";
        }

        const { data: userStores, error: userStoresErr } = await supabase
          .from("daraz_stores")
          .select("id")
          .or(`user_id.eq.${user.id},user_id.is.null`);

        if (userStoresErr) {
          logDashboardError("Dashboard Page UserStores Query", userStoresErr);
        } else {
          userStoreIds = (userStores || []).map((s: any) => s.id);
        }
      }
    } catch (e: any) {
      logDashboardError("Dashboard Page User Context Exception", e);
    }
  }

  // 1. Fetch Authorized Stores
  let storesList: any[] = [];
  let queryErrorNotice: string | null = configErrorMsg;

  if (supabase) {
    try {
      let storesQuery = supabase
        .from("daraz_stores")
        .select("id, store_code, store_name, region, is_active, seller_id, authorization_status, sync_status, updated_at, last_sync_error")
        .order("created_at", { ascending: true });

      if (userStoreIds.length > 0) {
        storesQuery = storesQuery.in("id", userStoreIds);
      }

      const { data: storesData, error: storesErr } = await storesQuery;
      if (storesErr) {
        // Fallback: exclude authorization_status if column is missing on DB
        const { data: fbData, error: fbErr } = await supabase
          .from("daraz_stores")
          .select("id, store_code, store_name, region, is_active, seller_id, sync_status, updated_at, last_sync_error")
          .order("created_at", { ascending: true });

        if (fbErr) {
          const isClockSkew = fbErr.message?.toLowerCase().includes("issued at future") || fbErr.message?.toLowerCase().includes("iat");
          if (!isClockSkew) {
            queryErrorNotice = `Store query notice: ${fbErr.message}`;
            logDashboardError("Dashboard Page Stores Query Fallback", fbErr);
          }
        } else {
          storesList = (fbData || []).map((s: any) => ({ ...s, authorization_status: "authorized" }));
        }
      } else {
        storesList = storesData || [];
      }
    } catch (ex: any) {
      const isClockSkew = ex?.message?.toLowerCase().includes("issued at future");
      if (!isClockSkew) {
        queryErrorNotice = ex?.message || String(ex);
        logDashboardError("Dashboard Page Stores Exception", ex);
      }
    }
  }

  // Fetch active store credentials server-side for connection state check
  const storeIds = storesList.map((s) => s.id);
  const activeCredMap = new Set<string>();
  if (supabase && storeIds.length > 0) {
    try {
      const { data: credsData } = await supabase
        .from("daraz_store_credentials")
        .select("store_id, access_token")
        .in("store_id", storeIds);

      (credsData || []).forEach((c: any) => {
        if (c.access_token && c.access_token.trim()) {
          activeCredMap.add(c.store_id);
        }
      });
    } catch (_) {}
  }

  // Filter Active Connected Stores (is_active = true & active credentials present or authorized status)
  const activeStoreIds = storesList
    .filter((s) => Boolean(s.is_active && (activeCredMap.has(s.id) || s.authorization_status === "authorized")))
    .map((s) => s.id);

  // 2. Fetch Listings & Orders Metrics across all active stores
  // Fetch Centralized Multi-Store Metrics
  let centralData: Awaited<ReturnType<typeof getCentralStoreMetrics>> | null = null;
  if (activeStoreIds.length > 0) {
    try {
      centralData = await getCentralStoreMetrics(selectedStoreId, activeStoreIds);
    } catch (metricsEx: any) {
      logDashboardError("Dashboard Page Metrics Exception", metricsEx);
      if (!queryErrorNotice) queryErrorNotice = `Metrics query notice: ${metricsEx?.message || String(metricsEx)}`;
    }
  }

  const enrichedStores = storesList.map((st, idx) => {
    const isConnected = Boolean(st?.is_active && (activeCredMap.has(st.id) || st?.authorization_status === "authorized"));
    const stMetrics = centralData?.perStoreMetrics[st.id];
    const displayName = getStoreDisplayName(st, idx);

    return {
      ...st,
      store_name: displayName,
      store_code: st?.store_code || "STORE",
      seller_id: st?.seller_id || "N/A",
      isConnected,
      productsCount: isConnected ? (stMetrics?.totalProducts ?? 0) : null,
      stockCount: isConnected ? (stMetrics?.totalStockUnits ?? 0) : null,
      ordersCount: isConnected ? (stMetrics?.totalOrders ?? 0) : null,
      inProgressOrdersCount: isConnected ? (stMetrics?.inProgressOrdersCount ?? 0) : null,
    };
  });

  const totalStoresCount = enrichedStores.length;
  const isMaxStoresReached = totalStoresCount >= 3;

  const totalProductsCount = centralData?.metrics.totalProductsCount ?? 0;
  const totalStockUnits = centralData?.metrics.totalStockUnits ?? 0;
  const lowStockCount = centralData?.metrics.lowStockCount ?? 0;
  const totalOrdersCount = centralData?.metrics.totalOrdersCount ?? 0;
  const inProgressOrdersCount = centralData?.metrics.inProgressOrdersCount ?? 0;
  const totalRevenueCents = centralData?.metrics.grossRevenueCents ?? 0;

  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="space-y-6">
      {/* Configuration or Query Diagnostic Notice Banner */}
      {queryErrorNotice && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-4 flex items-start space-x-3 text-amber-800 dark:text-amber-300 text-xs shadow-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              System Environment Diagnostic Notice
            </p>
            <p className="leading-relaxed">
              A database query or service client notice occurred during page render: <span className="font-mono text-amber-900 dark:text-amber-200">{queryErrorNotice}</span>. Diagnostic details logged under <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">[DASHBOARD FATAL ERROR]</code> in Vercel Runtime Logs.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 p-6 shadow-apple backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Welcome back, {userName}! 👋
              </h1>
              <span className="inline-flex items-center space-x-1 rounded-xl bg-orange-50 dark:bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-500/20">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span>Live Control Panel</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Multi-store operational control panel synchronized with official Daraz Open Platform.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <SyncNowButton />
          </div>
        </div>
      </div>

      {/* Primary Operational KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px] uppercase tracking-wider">Gross Sales</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none pt-1">
            {totalRevenueFormatted}
          </p>
          <p className="text-[10px] text-slate-400 font-medium">From {totalOrdersCount} total orders</p>
        </div>

        {/* Total Products */}
        <a
          href="/listings"
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-1 hover:border-orange-300 transition-all block"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px] uppercase tracking-wider">Active Products</span>
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none pt-1">
            {totalProductsCount} items
          </p>
          <p className="text-[10px] text-slate-400 font-medium">{totalStockUnits.toLocaleString()} total units in stock</p>
        </a>

        {/* Orders In Progress */}
        <a
          href="/orders?status=pending"
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-1 hover:border-orange-300 transition-all block"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px] uppercase tracking-wider">Orders To Fulfill</span>
            <ShoppingCart className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-extrabold text-orange-600 dark:text-orange-400 leading-none pt-1">
            {inProgressOrdersCount} orders
          </p>
          <p className="text-[10px] text-slate-400 font-medium">Requires packing & shipping</p>
        </a>

        {/* Low Stock Items */}
        <a
          href="/listings?status=low_stock"
          className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-1 hover:border-orange-300 transition-all block"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-bold text-[11px] uppercase tracking-wider">Low Stock Warning</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 leading-none pt-1">
            {lowStockCount} SKUs
          </p>
          <p className="text-[10px] text-slate-400 font-medium">Quantity ≤ 10 units</p>
        </a>
      </div>

      {/* Store Cards Overview Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">Store Cards Overview</h2>
            <span className="rounded-xl bg-orange-100 dark:bg-orange-500/10 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">
              {totalStoresCount} / 3 Stores
            </span>
          </div>

          <a href="/stores" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center space-x-1">
            <span>Manage Stores</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {enrichedStores.map((store, idx) => {
            const storeName = getStoreDisplayName(store, idx);
            const initials = getStoreInitials(storeName);

            const hasSyncError = Boolean(store.last_sync_error || store.sync_status === "error");

            return (
              <div
                key={store.id}
                className={`rounded-3xl border p-6 space-y-4 transition-all ${
                  store.isConnected
                    ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                    : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50 opacity-80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-2xl bg-orange-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{store.store_name}</h3>
                      <p className="text-[10px] font-mono text-slate-400">
                        {store.isConnected && store.seller_id && store.seller_id !== "N/A" ? `Seller ID: ${store.seller_id}` : "Disconnected Slot"}
                      </p>
                    </div>
                  </div>

                  {store.isConnected ? (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-bold">
                      <span>Disconnected</span>
                    </span>
                  )}
                </div>

                {hasSyncError && (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-medium flex items-center space-x-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>Notice: {store.last_sync_error || "Check API connection"}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Products</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? (hasSyncError && store.productsCount === 0 ? "Failed" : store.productsCount) : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Stock</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? (hasSyncError && store.stockCount === 0 ? "Failed" : store.stockCount) : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Orders</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? (hasSyncError && store.ordersCount === 0 ? "Failed" : store.ordersCount) : "--"}
                    </p>
                  </div>
                </div>

                {store.isConnected ? (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 font-semibold">Orders in Progress:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{store.inProgressOrdersCount}</span>
                  </div>
                ) : (
                  <p className="text-center text-[10px] text-slate-400 py-0.5">Connect store to see live data.</p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {store.isConnected ? (
                    <a
                      href={`/listings?store_id=${store.id}`}
                      className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      <span>Open Store</span>
                    </a>
                  ) : (
                    <StoreOnboardingClient
                      isMaxStoresReached={isMaxStoresReached}
                      storeId={store.id}
                      storeName={store.store_name}
                      isConnected={false}
                      mode="card_actions"
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Render Connect Store Card if totalStoresCount < 3 */}
          {!isMaxStoresReached && (
            <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px]">
              <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Add Daraz Store</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Connect up to {3 - totalStoresCount} more store account</p>
              </div>
              <StoreOnboardingClient
                isMaxStoresReached={isMaxStoresReached}
                storeId=""
                storeName=""
                isConnected={false}
                mode="button"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
