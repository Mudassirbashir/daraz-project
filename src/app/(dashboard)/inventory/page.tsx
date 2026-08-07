"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { InventoryDetailModal } from "@/components/inventory/InventoryDetailModal";
import {
  Boxes,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Columns,
  Copy,
  Check,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
  ShieldCheck,
  PackageCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Metrics state
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalAvailableStock: 0,
    totalReservedStock: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    recentlyUpdatedCount: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stores List
  const [stores, setStores] = useState<any[]>([]);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    product: true,
    sellerSku: true,
    darazSku: true,
    store: true,
    warehouse: true,
    available: true,
    reserved: true,
    sellable: true,
    status: true,
    lastUpdated: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Copy Feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Detail Modal state
  const [selectedInventoryDetail, setSelectedInventoryDetail] = useState<any | null>(null);

  const fetchStores = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("daraz_stores").select("id, store_code, store_name");
      setStores(data || []);
    } catch (err) {
      console.error("[FetchStores Error]:", err);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        stock_status: stockStatusFilter,
        store_id: storeFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setInventory(data.inventory || []);
        if (data.metrics) setMetrics(data.metrics);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchInventory API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchInventory Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [page, limit, searchQuery, stockStatusFilter, storeFilter, sortBy, sortOrder]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export CSV Handler
  const exportToCSV = () => {
    if (inventory.length === 0) {
      alert("No inventory records available to export.");
      return;
    }

    const headers = [
      "Seller SKU",
      "Product Name",
      "Category",
      "Available Stock",
      "Reserved Stock",
      "Sellable Net Stock",
      "Reorder Threshold",
      "Warehouse Location",
      "Store Code",
      "Store Name",
      "Last Synced At",
    ];

    const rows = inventory.map((item) => {
      const listing = item.listings?.[0] || {};
      const store = listing.daraz_stores || {};
      const available = item.quantity_on_hand || 0;
      const reserved = item.quantity_reserved || 0;

      return [
        `"${item.sku || ""}"`,
        `"${(item.title || "").replace(/"/g, '""')}"`,
        `"${item.category || "General"}"`,
        available,
        reserved,
        Math.max(0, available - reserved),
        item.reorder_point || 10,
        `"${item.storage_location || "Main Warehouse"}"`,
        `"${store.store_code || ""}"`,
        `"${store.store_name || ""}"`,
        `"${new Date(item.updated_at).toLocaleString()}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Inventory_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStockBadge = (qty: number, threshold = 10) => {
    if (qty > threshold) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>In Stock</span>
        </span>
      );
    }
    if (qty > 0) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>Low Stock (&le; {threshold})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 rounded-xl bg-red-50 dark:bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
        <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
        <span>Out of Stock (0)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Enterprise Inventory & Warehouse Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Centralized multi-store stock control, warehouse locations, automated low-stock detection, and CSV exports.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Inventory CSV</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Enterprise Inventory Dashboard Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Products</span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{metrics.totalProducts}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Available Stock</span>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.totalAvailableStock.toLocaleString()} Units</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reserved Stock</span>
          <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{metrics.totalReservedStock.toLocaleString()} Units</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Low Stock SKUs</span>
          <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{metrics.lowStockProducts}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Out of Stock</span>
          <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{metrics.outOfStockProducts}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Updated (24h)</span>
          <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-200">{metrics.recentlyUpdatedCount}</p>
        </div>
      </div>

      {/* Stock Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setStockStatusFilter("all");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            stockStatusFilter === "all" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Stock ({metrics.totalProducts})
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("in_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            stockStatusFilter === "in_stock" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          In Stock
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("low_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            stockStatusFilter === "low_stock" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Low Stock Alert ({metrics.lowStockProducts})
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("out_of_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            stockStatusFilter === "out_of_stock" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Out of Stock ({metrics.outOfStockProducts})
        </button>
      </div>

      {/* Controls Bar: Search, Store, Sort, Columns */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search inventory by Seller SKU, Product Name, Daraz Item ID, or Storage Bay..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Multi-Store Switcher Filter */}
          <div className="flex items-center space-x-1.5 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stores Combined</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.store_name} ({s.store_code})
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center space-x-1.5 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                setSortBy(sb);
                setSortOrder(so as "asc" | "desc");
              }}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="quantity_on_hand:desc">Stock: High to Low</option>
              <option value="quantity_on_hand:asc">Stock: Low to High</option>
              <option value="title:asc">Name (A-Z)</option>
              <option value="created_at:desc">Newest First</option>
            </select>
          </div>

          {/* Column Visibility Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="flex items-center space-x-1.5 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs apple-press"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-apple-modal z-30 space-y-2 text-xs">
                <p className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">Toggle Columns</p>
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-md">
                    <input
                      type="checkbox"
                      checked={(columnVisibility as any)[colKey]}
                      onChange={(e) =>
                        setColumnVisibility({
                          ...columnVisibility,
                          [colKey]: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="capitalize text-slate-700 dark:text-slate-300">{colKey.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Querying warehouse inventory records...</span>
          </div>
        ) : inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columnVisibility.product && <th className="px-4 py-3">Product Name</th>}
                  {columnVisibility.sellerSku && <th className="px-4 py-3">Seller SKU</th>}
                  {columnVisibility.darazSku && <th className="px-4 py-3">Daraz Item ID</th>}
                  {columnVisibility.store && <th className="px-4 py-3">Store</th>}
                  {columnVisibility.warehouse && <th className="px-4 py-3">Warehouse / Bay</th>}
                  {columnVisibility.available && <th className="px-4 py-3">Available</th>}
                  {columnVisibility.reserved && <th className="px-4 py-3">Reserved</th>}
                  {columnVisibility.sellable && <th className="px-4 py-3">Sellable Net</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Status</th>}
                  {columnVisibility.lastUpdated && <th className="px-4 py-3">Last Updated</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {inventory.map((item) => {
                  const listing = item.listings?.[0] || {};
                  const store = listing.daraz_stores || {};

                  const available = item.quantity_on_hand || 0;
                  const reserved = item.quantity_reserved || 0;
                  const sellable = Math.max(0, available - reserved);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {columnVisibility.product && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">Category: {item.category || "General"}</span>
                        </td>
                      )}

                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center space-x-1">
                            <span>{item.sku}</span>
                            <button
                              onClick={() => copyToClipboard(item.sku, item.id + "_sku")}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Copy SKU"
                            >
                              {copiedField === item.id + "_sku" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                      )}

                      {columnVisibility.darazSku && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{listing.daraz_item_id || "N/A"}</td>
                      )}

                      {columnVisibility.store && (
                        <td className="px-4 py-3">
                          <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {store.store_name || "Daraz Store"}
                          </span>
                        </td>
                      )}

                      {columnVisibility.warehouse && (
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                          {item.storage_location || "Main Warehouse"}
                        </td>
                      )}

                      {columnVisibility.available && (
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{available.toLocaleString()}</td>
                      )}

                      {columnVisibility.reserved && (
                        <td className="px-4 py-3 text-amber-700 dark:text-amber-400 font-semibold">{reserved.toLocaleString()}</td>
                      )}

                      {columnVisibility.sellable && (
                        <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400">{sellable.toLocaleString()}</td>
                      )}

                      {columnVisibility.status && (
                        <td className="px-4 py-3">{getStockBadge(available, item.reorder_point || 10)}</td>
                      )}

                      {columnVisibility.lastUpdated && (
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedInventoryDetail(item)}
                          className="inline-flex items-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all apple-press shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700 dark:text-slate-300">No inventory items found matching your current filter.</p>
            <p>Click "Sync Now" above to pull live inventory levels from Daraz Open Platform.</p>
          </div>
        )}

        {/* Pagination Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 dark:border-slate-800 px-4 py-3 text-xs gap-3 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>

            <span className="text-slate-500 ml-2">
              Showing {inventory.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center space-x-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all apple-press shadow-2xs"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="font-bold text-slate-800 dark:text-white px-2">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center space-x-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all apple-press shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Detail Modal */}
      {selectedInventoryDetail && (
        <InventoryDetailModal
          item={selectedInventoryDetail}
          onClose={() => setSelectedInventoryDetail(null)}
        />
      )}
    </div>
  );
}
