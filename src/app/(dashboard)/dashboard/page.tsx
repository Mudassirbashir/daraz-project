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
  Truck
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

  // 1. Fetch All Configured Stores
  const { data: stores } = await supabase
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const storesList = stores || [];

  // Calculate per-store metrics & store status
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

      const { data: listings } = await supabase
        .from("listings")
        .select("stock_quantity")
        .eq("store_id", st.id);

      const productsCount = (listings || []).length;
      const stockCount = (listings || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);

      const { data: orders } = await supabase
        .from("orders")
        .select("status")
        .eq("store_id", st.id);

      const ordersCount = (orders || []).length;
      const inProgressOrdersCount = (orders || []).filter((o) =>
        ["pending", "unpaid", "ready_to_ship", "shipped"].includes(o.status)
      ).length;

      return {
        ...st,
        isConnected: true,
        productsCount,
        stockCount,
        ordersCount,
        inProgressOrdersCount,
      };
    })
  );

  const totalStoresCount = enrichedStores.length;
  const connectedStoresCount = enrichedStores.filter((s) => s.isConnected).length;
  const disconnectedStoresCount = enrichedStores.filter((s) => !s.isConnected).length;

  // Selected store for filtered view
  const selectedStore = isCombinedView
    ? null
    : enrichedStores.find((s) => s.id === selectedStoreId);

  // 2. Query Aggregate Products
  let listingsQuery = supabase.from("listings").select("stock_quantity");
  if (!isCombinedView && selectedStoreId) {
    listingsQuery = listingsQuery.eq("store_id", selectedStoreId);
  }
  const { data: listingsData } = await listingsQuery;

  const totalProductsCount = (listingsData || []).length;
  const totalStockUnits = (listingsData || []).reduce((sum, item) => sum + (item.stock_quantity || 0), 0);
  const lowStockCount = (listingsData || []).filter((item) => (item.stock_quantity || 0) <= 10).length;

  // 3. Query Aggregate Orders & Sales
  let ordersQuery = supabase.from("orders").select("total_amount_cents, status");
  if (!isCombinedView && selectedStoreId) {
    ordersQuery = ordersQuery.eq("store_id", selectedStoreId);
  }
  const { data: ordersData } = await ordersQuery;

  const totalOrdersCount = (ordersData || []).length;
  const inProgressOrdersCount = (ordersData || []).filter((o: any) =>
    ["pending", "unpaid", "ready_to_ship", "shipped"].includes(o.status)
  ).length;

  const totalRevenueCents = (ordersData || []).reduce(
    (sum: number, o: any) => sum + (o.total_amount_cents || 0),
    0
  );
  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

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
            Here is a simple overview of all your Daraz stores, products, and orders.
          </p>
        </div>

        <SyncNowButton />
      </div>

      {/* High-Level Stores & Metrics Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-xs">
        {/* Total Stores */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 p-4 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Your Stores</span>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalStoresCount} Stores</p>
        </div>

        {/* Connected */}
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Connected</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">🟢 {connectedStoresCount}</p>
        </div>

        {/* Not Connected */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-800/50 p-4 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Not Connected</span>
          <p className="mt-1 text-2xl font-bold text-slate-600 dark:text-slate-400">⚪ {disconnectedStoresCount}</p>
        </div>

        {/* Total Products */}
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10 p-4 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">My Products</span>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{totalProductsCount}</p>
        </div>

        {/* Total Orders */}
        <div className="rounded-2xl border border-purple-200/80 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-500/10 p-4 shadow-apple col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">My Orders</span>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{totalOrdersCount}</p>
        </div>
      </div>

      {/* Disconnected Store Notice Banner */}
      {disconnectedStoresCount > 0 && (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 dark:bg-amber-500/10 p-5 shadow-apple">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-xs">
            <div className="flex items-center space-x-3">
              <div className="rounded-xl bg-amber-500 p-2.5 text-white shadow-md">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                  {disconnectedStoresCount} Store{disconnectedStoresCount > 1 ? "s" : ""} Need Connection
                </h3>
                <p className="text-amber-800 dark:text-amber-400 font-medium">
                  Connect your other stores to see their live products, stock, and orders.
                </p>
              </div>
            </div>

            <a
              href="/stores"
              className="inline-flex items-center space-x-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press self-start md:self-auto shrink-0"
            >
              <span>Manage Stores</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* Stores Overview Cards Grid */}
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

      {/* Simple Question-Answering Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Products */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              📦 Products
            </span>
            <Package className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {totalProductsCount} products
          </p>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Available across connected stores
          </span>
        </div>

        {/* Orders */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              🛒 Total Orders
            </span>
            <ShoppingCart className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {totalOrdersCount} orders
          </p>
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
            Total sales received from customers
          </span>
        </div>

        {/* Sales */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              💰 Total Sales
            </span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {totalRevenueFormatted}
          </p>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Total sales value
          </span>
        </div>

        {/* Total Stock */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              📊 Total Stock
            </span>
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {totalStockUnits} units
          </p>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Items in stock ready to deliver
          </span>
        </div>

        {/* Low Stock */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ⚠️ Low Stock
            </span>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {lowStockCount} items
          </p>
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Need reordering soon (10 or fewer left)
          </span>
        </div>

        {/* Orders needing attention */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              🚚 In Progress
            </span>
            <Truck className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {inProgressOrdersCount} orders
          </p>
          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
            Waiting to be packed or shipped
          </span>
        </div>
      </div>
    </div>
  );
}
