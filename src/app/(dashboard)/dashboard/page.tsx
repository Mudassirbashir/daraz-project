import React from "react";
import {
  Store,
  ShoppingCart,
  Package,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Truck,
  Flame,
  CheckCircle2,
  PackageCheck,
  Printer
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SyncNowButton } from "@/components/common/SyncNowButton";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams?: {
    storeId?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createAdminClient();
  const selectedStoreId = searchParams?.storeId || "all";
  const isCombinedView = selectedStoreId === "all";

  // Fetch logged-in user profile name
  let userName = "Mubashir";
  try {
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.full_name) {
        userName = profile.full_name.split(" ")[0];
      }
    }
  } catch (e) {
    // fallback to Mubashir
  }

  // 1. Fetch Stores
  const { data: storesData } = await supabase
    .from("daraz_stores")
    .select("id, store_code, store_name, region, is_active, seller_id, access_token, updated_at")
    .order("store_code", { ascending: true });

  let storesList = storesData || [];

  // 2. Fetch Listings & Orders Metrics
  let listingsQuery = supabase.from("listings").select("store_id, stock_quantity");
  if (!isCombinedView && selectedStoreId) {
    listingsQuery = listingsQuery.eq("store_id", selectedStoreId);
  }

  let ordersQuery = supabase.from("orders").select("id, store_id, status, workflow_status, is_packed, is_label_printed, total_amount_cents, order_date, created_at");
  if (!isCombinedView && selectedStoreId) {
    ordersQuery = ordersQuery.eq("store_id", selectedStoreId);
  }

  const [listingsResult, ordersResult, syncFailedResult] = await Promise.all([
    listingsQuery,
    ordersQuery,
    supabase.from("daraz_api_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const listingsData = listingsResult.data || [];
  const ordersList = ordersResult.data || [];
  const syncFailedCount = syncFailedResult.count || 0;

  // Build per-store metrics map in memory (robust normalized string keys)
  const storeListingsMap: Record<string, { count: number; stock: number }> = {};
  listingsData.forEach((l: any) => {
    const key = String(l.store_id || "").toLowerCase();
    if (!storeListingsMap[key]) storeListingsMap[key] = { count: 0, stock: 0 };
    storeListingsMap[key].count += 1;
    storeListingsMap[key].stock += l.stock_quantity || 0;
  });

  const storeOrdersMap: Record<string, { total: number; inProgress: number }> = {};
  ordersList.forEach((o: any) => {
    const key = String(o.store_id || "").toLowerCase();
    if (!storeOrdersMap[key]) storeOrdersMap[key] = { total: 0, inProgress: 0 };
    storeOrdersMap[key].total += 1;
    const statusNorm = String(o.workflow_status || o.status || "").toLowerCase();
    if (["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"].includes(statusNorm)) {
      storeOrdersMap[key].inProgress += 1;
    }
  });

  const enrichedStores = storesList.map((st) => {
    const isConnected = Boolean(st.access_token && st.is_active);
    const key = String(st.id).toLowerCase();
    const storeListingStats = storeListingsMap[key] || { count: 0, stock: 0 };
    const storeOrderStats = storeOrdersMap[key] || { total: 0, inProgress: 0 };

    return {
      ...st,
      isConnected,
      productsCount: isConnected ? storeListingStats.count : null,
      stockCount: isConnected ? storeListingStats.stock : null,
      ordersCount: isConnected ? storeOrderStats.total : null,
      inProgressOrdersCount: isConnected ? storeOrderStats.inProgress : null,
    };
  });

  const totalStoresCount = enrichedStores.length;
  const connectedStoresCount = enrichedStores.filter((s) => s.isConnected).length;
  const disconnectedStoresCount = enrichedStores.filter((s) => !s.isConnected).length;

  const totalProductsCount = listingsData.length;
  const totalStockUnits = listingsData.reduce((sum, item) => sum + (item.stock_quantity || 0), 0);
  const lowStockCount = listingsData.filter((item) => (item.stock_quantity || 0) <= 10).length;

  const totalOrdersCount = ordersList.length;
  const inProgressOrdersCount = ordersList.filter((o: any) =>
    ["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"].includes(String(o.workflow_status || o.status || "").toLowerCase())
  ).length;

  const totalRevenueCents = ordersList.reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);
  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  // Action Center Metrics
  const nowMs = Date.now();
  const ordersWaitingCount = ordersList.filter((o: any) => {
    const st = String(o.status || o.workflow_status || "").toLowerCase();
    return ["pending", "unpaid"].includes(st);
  }).length;

  const ordersAtRiskCount = ordersList.filter((o: any) => {
    const st = String(o.status || o.workflow_status || "").toLowerCase();
    if (!["pending", "unpaid"].includes(st)) return false;
    const ageHours = (nowMs - new Date(o.order_date || o.created_at).getTime()) / (1000 * 60 * 60);
    return ageHours >= 12 && ageHours < 24;
  }).length;

  const ordersDelayedCount = ordersList.filter((o: any) => {
    const st = String(o.status || o.workflow_status || "").toLowerCase();
    if (!["pending", "unpaid"].includes(st)) return false;
    const ageHours = (nowMs - new Date(o.order_date || o.created_at).getTime()) / (1000 * 60 * 60);
    return ageHours >= 24;
  }).length;

  // Order Aging Bucket Counts
  let bucketUnder2h = 0;
  let bucket2to6h = 0;
  let bucket6to12h = 0;
  let bucket12to24h = 0;
  let bucketOver24h = 0;

  ordersList.forEach((o: any) => {
    const st = String(o.status || o.workflow_status || "").toLowerCase();
    if (!["pending", "unpaid", "ready_to_ship"].includes(st)) return;

    const ageHours = (nowMs - new Date(o.order_date || o.created_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 2) bucketUnder2h++;
    else if (ageHours < 6) bucket2to6h++;
    else if (ageHours < 12) bucket6to12h++;
    else if (ageHours < 24) bucket12to24h++;
    else bucketOver24h++;
  });

  return (
    <div className="space-y-6">
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
              Here is your multi-store operational overview synchronized with Daraz Seller Center.
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
          <p className="text-[10px] text-slate-400 font-medium">Quantity $\le$ 10 units</p>
        </a>
      </div>

      {/* ORDER AGING DIAGNOSTICS */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <h2 className="font-bold text-slate-900 dark:text-white text-base">ORDER AGING DIAGNOSTICS</h2>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-bold">
            <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              Orders Waiting: {ordersWaitingCount}
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
              At Risk: {ordersAtRiskCount}
            </span>
            <span className="px-3 py-1 rounded-xl bg-red-50 text-red-800 border border-red-200">
              Delayed: {ordersDelayedCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 text-center border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">&lt; 2 Hours</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{bucketUnder2h}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 text-center border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2–6 Hours</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{bucket2to6h}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4 text-center border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">6–12 Hours</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{bucket6to12h}</p>
          </div>

          <div className="rounded-2xl bg-amber-50/50 dark:bg-amber-500/10 p-4 text-center border border-amber-200/80 dark:border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">12–24 Hours (At Risk)</span>
            <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">{bucket12to24h}</p>
          </div>

          <div className="rounded-2xl bg-red-50/50 dark:bg-red-500/10 p-4 text-center border border-red-200/80 dark:border-red-500/20">
            <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">24+ Hours (Delayed)</span>
            <p className="text-2xl font-extrabold text-red-700 dark:text-red-400 mt-1">{bucketOver24h}</p>
          </div>
        </div>
      </div>

      {/* Store Cards Overview Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">Store Cards Overview</h2>
          <a href="/stores" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center space-x-1">
            <span>See All Stores ({totalStoresCount})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {enrichedStores.map((store) => {
            const initials = store.store_name
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

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
                      <p className="text-[10px] font-mono text-slate-400">Seller ID: {store.seller_id}</p>
                    </div>
                  </div>

                  {store.isConnected ? (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-bold">
                      <span>Not Connected</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Products</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? store.productsCount : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Stock</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? store.stockCount : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Orders</span>
                    <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                      {store.isConnected ? store.ordersCount : "--"}
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
                    <a
                      href="/api/auth/daraz/login"
                      className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600 shadow-sm"
                    >
                      <span>Connect Store</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
