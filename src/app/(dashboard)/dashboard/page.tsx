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
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // 1. Fetch Store Information
  const { data: stores } = await supabase
    .from("daraz_stores")
    .select("*")
    .order("store_code", { ascending: true });

  const activeStoresList = (stores || []).filter((s) => s.is_active);
  const selectedStore = isCombinedView
    ? null
    : activeStoresList.find((s) => s.id === selectedStoreId);

  const hasAnyAccessToken = activeStoresList.some((s) => Boolean(s.access_token));
  const isSelectedStoreLinked = selectedStore ? Boolean(selectedStore.access_token) : hasAnyAccessToken;

  // 2. Query Live Products / Listings
  let listingsQuery = supabase.from("listings").select("*", { count: "exact", head: true });
  if (!isCombinedView && selectedStoreId) {
    listingsQuery = listingsQuery.eq("store_id", selectedStoreId);
  }
  const { count: productsCount } = await listingsQuery;

  // 3. Query Live Orders & Revenue
  let ordersQuery = supabase.from("orders").select("total_amount_cents, status");
  if (!isCombinedView && selectedStoreId) {
    ordersQuery = ordersQuery.eq("store_id", selectedStoreId);
  }
  const { data: ordersData } = await ordersQuery;

  const totalOrdersCount = (ordersData || []).length;
  const pendingOrdersCount = (ordersData || []).filter((o: any) =>
    ["pending", "unpaid", "ready_to_ship"].includes(o.status)
  ).length;

  const totalRevenueCents = (ordersData || []).reduce(
    (sum: number, o: any) => sum + (o.total_amount_cents || 0),
    0
  );
  const totalRevenueFormatted = (totalRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  // 4. Query Live Central Inventory & Low Stock Items
  const { data: inventoryItems } = await supabase
    .from("inventory")
    .select("quantity_on_hand, reorder_point");

  const totalInventoryUnits = (inventoryItems || []).reduce(
    (sum: number, item: any) => sum + (item.quantity_on_hand || 0),
    0
  );
  const lowStockCount = (inventoryItems || []).filter(
    (item: any) => (item.quantity_on_hand || 0) <= (item.reorder_point || 10)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Bar with Dynamic Store Context & Live Refresh */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isCombinedView
                ? "Combined Multi-Store Operations Center"
                : `Store Portal: ${selectedStore?.store_name || "Selected Store"}`}
            </h1>
            <span className="rounded-xl bg-orange-50 dark:bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-500/20">
              {isCombinedView ? `${activeStoresList.length} Stores Active` : selectedStore?.store_code}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            {isCombinedView
              ? "Showing aggregated performance data across all connected Daraz seller accounts."
              : `Filtered operational metrics for ${selectedStore?.store_name} (Seller ID: ${selectedStore?.seller_id}).`}
          </p>
        </div>
        <SyncNowButton />
      </div>

      {/* Connect Daraz Store Banner if Selected Store / System Lacks Access Token */}
      {!isSelectedStoreLinked && (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 dark:bg-amber-500/10 p-6 shadow-apple">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start space-x-4">
              <div className="rounded-xl bg-amber-500 p-3 text-white shadow-md">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">
                  {selectedStore
                    ? `OAuth Token Missing for ${selectedStore.store_name}`
                    : "No Daraz Stores Connected"}
                </h3>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-400 font-medium">
                  Authorize this Daraz seller account to enable live API catalog, order processing, and inventory synchronization.
                </p>
              </div>
            </div>

            <a
              href="/api/auth/daraz/login"
              className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-5 py-3 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:brightness-105 transition-all apple-press shrink-0"
            >
              <Store className="h-4 w-4" />
              <span>Connect Store OAuth</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* 6 Core Multi-Store Dashboard Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1. Total Products Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Products / SKUs
            </span>
            <Package className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {productsCount || 0} SKUs
          </p>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {isCombinedView ? "Across All Active Stores" : `Listings for ${selectedStore?.store_code}`}
          </span>
        </div>

        {/* 2. Total Orders Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Orders
            </span>
            <ShoppingCart className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalOrdersCount} Orders
          </p>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Live Order Tracking
          </span>
        </div>

        {/* 3. Total Revenue Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Revenue
            </span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalRevenueFormatted}
          </p>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Gross Order Sales Volume
          </span>
        </div>

        {/* 4. Total Inventory Stock Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Inventory Stock
            </span>
            <ShieldCheck className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalInventoryUnits} Units
          </p>
          <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
            Central Warehouse Quantity
          </span>
        </div>

        {/* 5. Low Stock Alert Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Low Stock Items
            </span>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {lowStockCount} Items
          </p>
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Reorder Threshold (&le; 10)
          </span>
        </div>

        {/* 6. Pending Orders Metric */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Fulfillment
            </span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {pendingOrdersCount} Pending
          </p>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Awaiting Dispatch / Processing
          </span>
        </div>
      </div>
    </div>
  );
}
