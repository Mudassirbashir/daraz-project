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
      const { data } = await (supabase as any).from("daraz_stores").select("id, store_code, store_name");
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
        <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>In Stock</span>
        </span>
      );
    }
    if (qty > 0) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          <span>Low Stock (&le; {threshold})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
        <XCircle className="h-3 w-3 text-red-600" />
        <span>Out of Stock (0)</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enterprise Inventory & Warehouse Management</h1>
          <p className="text-xs text-slate-500">
            Centralized multi-store stock control, warehouse locations, automated low-stock detection, and CSV exports.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Inventory CSV</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Enterprise Inventory Dashboard Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Total Products</span>
          <p className="mt-1 text-xl font-bold text-slate-900">{metrics.totalProducts}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Available Stock</span>
          <p className="mt-1 text-xl font-bold text-emerald-600">{metrics.totalAvailableStock.toLocaleString()} Units</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Reserved Stock</span>
          <p className="mt-1 text-xl font-bold text-amber-600">{metrics.totalReservedStock.toLocaleString()} Units</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Low Stock SKUs</span>
          <p className="mt-1 text-xl font-bold text-amber-600">{metrics.lowStockProducts}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-slate-500">Out of Stock</span>
          <p className="mt-1 text-xl font-bold text-red-600">{metrics.outOfStockProducts}</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm">
          <span className="text-[10px] font-bold uppercase text-blue-700">Updated (24h)</span>
          <p className="mt-1 text-xl font-bold text-blue-900">{metrics.recentlyUpdatedCount}</p>
        </div>
      </div>

      {/* Stock Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setStockStatusFilter("all");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            stockStatusFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Stock ({metrics.totalProducts})
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("in_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            stockStatusFilter === "in_stock" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          In Stock
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("low_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            stockStatusFilter === "low_stock" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Low Stock Alert ({metrics.lowStockProducts})
        </button>

        <button
          onClick={() => {
            setStockStatusFilter("out_of_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            stockStatusFilter === "out_of_stock" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Out of Stock ({metrics.outOfStockProducts})
        </button>
      </div>

      {/* Controls Bar: Search, Store, Sort, Columns */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Multi-Store Switcher Filter */}
          <div className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
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
          <div className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                setSortBy(sb);
                setSortOrder(so as "asc" | "desc");
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
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
              className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-30 space-y-2 text-xs">
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">Toggle Columns</p>
                {Object.keys(columnVisibility).map((colKey) => (
                  <label key={colKey} className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded-md">
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
                    <span className="capitalize text-slate-700">{colKey.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Querying warehouse inventory records...</span>
          </div>
        ) : inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const listing = item.listings?.[0] || {};
                  const store = listing.daraz_stores || {};

                  const available = item.quantity_on_hand || 0;
                  const reserved = item.quantity_reserved || 0;
                  const sellable = Math.max(0, available - reserved);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.product && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">Category: {item.category || "General"}</span>
                        </td>
                      )}

                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
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
                        <td className="px-4 py-3 font-mono text-slate-600">{listing.daraz_item_id || "N/A"}</td>
                      )}

                      {columnVisibility.store && (
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                            {store.store_name || "M Saleem Mall"}
                          </span>
                        </td>
                      )}

                      {columnVisibility.warehouse && (
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {item.storage_location || "Main Shelf A-1"}
                        </td>
                      )}

                      {columnVisibility.available && (
                        <td className="px-4 py-3 font-bold text-slate-900">{available.toLocaleString()}</td>
                      )}

                      {columnVisibility.reserved && (
                        <td className="px-4 py-3 text-amber-700 font-semibold">{reserved.toLocaleString()}</td>
                      )}

                      {columnVisibility.sellable && (
                        <td className="px-4 py-3 font-bold text-emerald-700">{sellable.toLocaleString()}</td>
                      )}

                      {columnVisibility.status && (
                        <td className="px-4 py-3">{getStockBadge(available, item.reorder_point || 10)}</td>
                      )}

                      {columnVisibility.lastUpdated && (
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {new Date(item.updated_at).toLocaleString()}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedInventoryDetail(item)}
                          className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
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
            <p className="font-medium text-slate-700">No inventory items found matching your current filter.</p>
            <p>Click "Sync Now" above to pull live inventory levels from Daraz Open Platform.</p>
          </div>
        )}

        {/* Pagination Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 px-4 py-3 text-xs gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 focus:outline-none"
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
              className="flex items-center space-x-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="font-bold text-slate-800 px-2">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center space-x-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-all"
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
