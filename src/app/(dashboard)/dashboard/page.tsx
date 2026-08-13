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

  // 1. Fetch Stores & Active User Profile in parallel
  const [storesResult, userProfileResult] = await Promise.all([
    supabase.from("daraz_stores").select("id, store_code, store_name, region, is_active, seller_id, access_token, updated_at").order("store_code", { ascending: true }),
    (async () => {
      try {
        const serverSupabase = createClient();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          if (profile?.full_name) return profile.full_name.split(" ")[0];
        }
      } catch (e) {}
      return "Mubashir";
    })(),
  ]);

  userName = userProfileResult;
  const storesList = storesResult.data || [];

  // 2. Fetch Selective Column Metrics in Parallel
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

  // Build per-store metrics map in memory (O(N) single pass instead of N async DB roundtrips)
  const storeListingsMap: Record<string, { count: number; stock: number }> = {};
  listingsData.forEach((l: any) => {
    if (!storeListingsMap[l.store_id]) storeListingsMap[l.store_id] = { count: 0, stock: 0 };
    storeListingsMap[l.store_id].count += 1;
    storeListingsMap[l.store_id].stock += l.stock_quantity || 0;
  });

  const storeOrdersMap: Record<string, { total: number; inProgress: number }> = {};
  ordersList.forEach((o: any) => {
    if (!storeOrdersMap[o.store_id]) storeOrdersMap[o.store_id] = { total: 0, inProgress: 0 };
    storeOrdersMap[o.store_id].total += 1;
    if (["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"].includes(o.workflow_status || o.status)) {
      storeOrdersMap[o.store_id].inProgress += 1;
    }
  });

  const enrichedStores = storesList.map((st) => {
    const isConnected = Boolean(st.access_token);
    const storeListingStats = storeListingsMap[st.id] || { count: 0, stock: 0 };
    const storeOrderStats = storeOrdersMap[st.id] || { total: 0, inProgress: 0 };

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
    ["pending", "unpaid", "ready_to_ship", "shipped", "picking", "packed"].includes(o.workflow_status || o.status)
  ).length;

  const totalRevenueCents = ordersList.reduce((sum: number, o: any) => sum + (o.total_amount_cents || 0), 0);
  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  // 4. ACTION CENTER METRICS (PART 9)
  const nowMs = Date.now();

  const waitingForPackingCount = ordersList.filter(
    (o) => !o.is_packed && ["pending", "ready_to_ship", "ready_to_pack", "picked"].includes(o.workflow_status || o.status)
  ).length;

  const olderThan12HoursCount = ordersList.filter((o) => {
    const createdMs = new Date(o.order_date || o.created_at).getTime();
    const isCompleted = ["delivered", "canceled", "returned"].includes(o.workflow_status || o.status);
    return !isCompleted && nowMs - createdMs > 12 * 60 * 60 * 1000;
  }).length;



  const missingLabelsCount = ordersList.filter(
    (o) => o.is_packed && !o.is_label_printed
  ).length;

  const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const shippedTodayCount = ordersList.filter((o) => {
    return (
      ["shipped", "dispatched", "delivered"].includes(o.workflow_status || o.status) &&
      new Date(o.order_date || o.created_at).toISOString() >= todayStartIso
    );
  }).length;

  // 5. ORDER AGING METRICS (PART 10)
  const activeOrders = ordersList.filter(
    (o) => !["delivered", "canceled", "returned"].includes(o.workflow_status || o.status)
  );

  let ageUnder2h = 0;
  let age2to6h = 0;
  let age6to12h = 0;
  let age12to24h = 0;
  let age24hPlus = 0;

  activeOrders.forEach((o) => {
    const ageHours = (nowMs - new Date(o.order_date || o.created_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 2) ageUnder2h++;
    else if (ageHours < 6) age2to6h++;
    else if (ageHours < 12) age6to12h++;
    else if (ageHours < 24) age12to24h++;
    else age24hPlus++;
  });

  const ordersAtRiskCount = age12to24h;
  const ordersDelayedCount = age24hPlus;

  return (
    <div className="space-y-6">
      {/* Top Greeting & Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Welcome back, {userName}</span>
            <span>👋</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Operational Control Center & Action Center for your Daraz stores.
          </p>
        </div>

        <SyncNowButton />
      </div>

      {/* ACTION CENTER CARD (PART 9) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">ACTION CENTER</h2>
            <span className="text-xs text-slate-500 font-medium">What do I need to do right now?</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Urgent 1: Waiting for Packing */}
          <a
            href="/operations?stage=ready_to_pack"
            className="p-4 rounded-2xl bg-red-50/70 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:border-red-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🔴</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {waitingForPackingCount} orders waiting for packing
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to open packing station</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-500 group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Urgent 2: Older than 12 Hours */}
          <a
            href="/orders?aging=delayed"
            className="p-4 rounded-2xl bg-red-50/70 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:border-red-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🔴</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {olderThan12HoursCount} orders older than 12 hours
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to view delayed orders</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-500 group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Urgent 3: Sync Failed */}
          <a
            href="/operations?tab=errors"
            className="p-4 rounded-2xl bg-red-50/70 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:border-red-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🔴</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {syncFailedCount || 0} Daraz sync failures
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to open Error Center & retry</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-red-500 group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Warning 1: Low Stock */}
          <a
            href="/inventory?stock=low"
            className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 hover:border-amber-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🟠</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {lowStockCount} products out / low in stock
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to review stock levels</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Warning 2: Missing Shipping Labels */}
          <a
            href="/operations?stage=missing_label"
            className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 hover:border-amber-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🟠</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {missingLabelsCount} shipping labels missing
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to print official labels</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-amber-500 group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Success: Shipped Today */}
          <a
            href="/orders?stage=shipped"
            className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 hover:border-emerald-400 transition-all flex items-center justify-between group"
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">🟢</span>
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {shippedTodayCount} orders shipped today
                </p>
                <p className="text-slate-500 font-medium text-[11px]">Click to open shipped records</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-emerald-500 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>

      {/* ORDER AGING WIDGET (PART 10) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">ORDER AGING DIAGNOSTICS</h2>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold border border-blue-200">
              Orders Waiting: {activeOrders.length}
            </span>
            <span className="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-200">
              At Risk: {ordersAtRiskCount}
            </span>
            <span className="px-3 py-1 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 font-bold border border-red-200">
              Delayed: {ordersDelayedCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <a
            href="/orders?aging=under2h"
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-center"
          >
            <span className="text-slate-500 font-semibold text-[11px]">&lt; 2 Hours</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{ageUnder2h}</p>
          </a>

          <a
            href="/orders?aging=2to6h"
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-center"
          >
            <span className="text-slate-500 font-semibold text-[11px]">2–6 Hours</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{age2to6h}</p>
          </a>

          <a
            href="/orders?aging=6to12h"
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-center"
          >
            <span className="text-slate-500 font-semibold text-[11px]">6–12 Hours</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{age6to12h}</p>
          </a>

          <a
            href="/orders?aging=12to24h"
            className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:border-amber-500 transition-all text-center"
          >
            <span className="text-amber-700 dark:text-amber-400 font-bold text-[11px]">12–24 Hours (At Risk)</span>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{age12to24h}</p>
          </a>

          <a
            href="/orders?aging=24hplus"
            className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 hover:border-red-500 transition-all text-center col-span-2 sm:col-span-1"
          >
            <span className="text-red-700 dark:text-red-400 font-bold text-[11px]">24+ Hours (Delayed)</span>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">{age24hPlus}</p>
          </a>
        </div>
      </div>

      {/* High-Level Stores Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Store Cards Overview</h2>
          <a href="/stores" className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
            See All Stores ({totalStoresCount}) &rarr;
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
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
                className={`rounded-2xl border p-5 space-y-4 shadow-apple transition-all duration-200 hover:shadow-apple-hover ${
                  store.isConnected
                    ? "border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl"
                    : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-10 w-10 rounded-xl bg-orange-500 text-white font-extrabold flex items-center justify-center text-sm shadow-md shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                        {store.store_name}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-500">Seller ID: {store.seller_id}</p>
                    </div>
                  </div>

                  {store.isConnected ? (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                      <span>Not Connected</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 p-2 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400">Products</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {store.isConnected ? store.productsCount : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 p-2 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400">Stock</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {store.isConnected ? store.stockCount : "--"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 p-2 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400">Orders</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {store.isConnected ? store.ordersCount : "--"}
                    </p>
                  </div>
                </div>

                {store.isConnected ? (
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500 font-semibold">Orders in Progress:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {store.inProgressOrdersCount}
                    </span>
                  </div>
                ) : (
                  <p className="text-center text-[10px] text-slate-400 font-medium">
                    Connect store to see live data.
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {store.isConnected ? (
                    <a
                      href={`/listings?store_id=${store.id}`}
                      className="w-full inline-flex items-center justify-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 py-2 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                      <span>Open Store</span>
                    </a>
                  ) : (
                    <a
                      href="/api/auth/daraz/login"
                      className="w-full inline-flex items-center justify-center space-x-1.5 rounded-xl bg-orange-500 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all apple-press shadow-sm"
                    >
                      <Store className="h-3.5 w-3.5" />
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
