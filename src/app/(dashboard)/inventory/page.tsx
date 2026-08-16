"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { InventoryDetailModal } from "@/components/inventory/InventoryDetailModal";
import {
  Boxes,
  Search,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Columns,
  Eye,
  ChevronLeft,
  ChevronRight,
  Store
} from "lucide-react";

function InventoryPageContent() {
  const searchParams = useSearchParams();
  const currentStoreId = searchParams.get("storeId") || searchParams.get("store_id") || "all";

  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("all");

  // Metrics state
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalAvailableStock: 0,
    totalReservedStock: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    sellerSku: true,
    store: true,
    title: true,
    location: true,
    available: true,
    reserved: true,
    sellable: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Detail Modal state
  const [selectedInventoryDetail, setSelectedInventoryDetail] = useState<any | null>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        stock_status: stockStatusFilter,
        store_id: currentStoreId,
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
    fetchInventory();
  }, [page, limit, searchQuery, stockStatusFilter, currentStoreId]);

  const exportToCSV = () => {
    if (inventory.length === 0) {
      alert("No inventory records available to export.");
      return;
    }

    const headers = ["Product Code", "Store", "Product Name", "Shelf Location", "Stock Available", "On Hold", "Ready to Sell"];
    const rows = inventory.map((item) => [
      `"${item.sku || ""}"`,
      `"${item.store_name || "Daraz Store"}"`,
      `"${(item.title || "").replace(/"/g, '""')}"`,
      `"${item.storage_location || "Main Warehouse"}"`,
      item.quantity_on_hand || 0,
      item.quantity_reserved || 0,
      Math.max(0, (item.quantity_on_hand || 0) - (item.quantity_reserved || 0)),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Inventory_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
            {currentStoreId !== "all" && (
              <span className="inline-flex items-center space-x-1 rounded-xl bg-orange-50 border border-orange-200 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                <Store className="h-3.5 w-3.5 text-orange-500" />
                <span>Store Scoped</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Store-isolated sellable product inventory from Daraz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download stock inventory list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Stock List</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Stock Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 text-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Products</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalProducts || 0} items</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Available Stock</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{(metrics.totalAvailableStock || 0).toLocaleString()} units</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Low Stock Alert</span>
          <p className="mt-1 text-2xl font-bold text-amber-700">{metrics.lowStockProducts || 0} low</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Out of Stock</span>
          <p className="mt-1 text-2xl font-bold text-red-700">{metrics.outOfStockProducts || 0} empty</p>
        </div>
      </div>

      {/* Controls Bar: Search & Column Selector */}
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
            placeholder="Search stock by product name, Seller SKU, or item ID..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={stockStatusFilter}
            onChange={(e) => {
              setStockStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock (&gt; 0)</option>
            <option value="low_stock">Low Stock Alert (1-10 units)</option>
            <option value="out_of_stock">Out of Stock (0 units)</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Choose which columns to show"
              className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-30 space-y-2">
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

      {/* Stock Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading stock inventory...</span>
          </div>
        ) : inventory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.sellerSku && <th className="px-4 py-3">Product Code / SKU</th>}
                  {columnVisibility.store && <th className="px-4 py-3">Store</th>}
                  {columnVisibility.title && <th className="px-4 py-3">Product Name</th>}
                  {columnVisibility.location && <th className="px-4 py-3">Shelf Location</th>}
                  {columnVisibility.available && <th className="px-4 py-3">Stock Available</th>}
                  {columnVisibility.reserved && <th className="px-4 py-3">On Hold</th>}
                  {columnVisibility.sellable && <th className="px-4 py-3">Ready to Sell</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {inventory.map((i) => {
                  const onHand = i.quantity_on_hand || 0;
                  const reserved = i.quantity_reserved || 0;
                  const sellable = Math.max(0, onHand - reserved);

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{i.sku || "SKU-001"}</td>
                      )}

                      {columnVisibility.store && (
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          <span className="inline-flex items-center space-x-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            <Store className="h-3 w-3 text-slate-500" />
                            <span>{i.store_name || "Daraz Store"}</span>
                          </span>
                        </td>
                      )}

                      {columnVisibility.title && (
                        <td className="px-4 py-3 font-bold text-slate-900">{i.title || "Product Item"}</td>
                      )}

                      {columnVisibility.location && (
                        <td className="px-4 py-3 font-mono text-slate-600">{i.storage_location || "Main Warehouse"}</td>
                      )}

                      {columnVisibility.available && (
                        <td className="px-4 py-3 font-bold text-slate-900">{onHand} units</td>
                      )}

                      {columnVisibility.reserved && (
                        <td className="px-4 py-3 font-bold text-blue-700">{reserved} units</td>
                      )}

                      {columnVisibility.sellable && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[11px] ${
                            onHand === 0
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : onHand <= 10
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {sellable} ready {onHand === 0 ? "(Out of Stock)" : onHand <= 10 ? "(Low Stock)" : ""}
                          </span>
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedInventoryDetail(i)}
                          title="See stock location and details"
                          className="inline-flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>See Details</span>
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
            <p className="font-medium text-slate-700">No stock records found for this store/search criteria.</p>
          </div>
        )}

        {/* Pagination Footer */}
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

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
        <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
        <span>Loading stock page...</span>
      </div>
    }>
      <InventoryPageContent />
    </Suspense>
  );
}
