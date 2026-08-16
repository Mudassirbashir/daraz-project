"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { PrintableLabelModal } from "@/components/operations/PrintableLabelModal";
import { PackingModal } from "@/components/operations/PackingModal";
import { PickingModal } from "@/components/operations/PickingModal";
import { ErrorCenterView } from "@/components/operations/ErrorCenterView";
import { AuditLogsView } from "@/components/operations/AuditLogsView";
import {
  CheckSquare,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Download,
  Printer,
  Barcode,
  QrCode,
  Box,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  Building2,
  UserCheck
} from "lucide-react";

export default function OperationsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageTab, setStageTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");

  // WMS Metrics
  const [metrics, setMetrics] = useState<any>({
    ordersWaiting: 0,
    ordersPicked: 0,
    ordersPacked: 0,
    ordersShipped: 0,
    avgProcessingTimeMinutes: 0,
    employeeProductivityScore: 100,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Selection & Bulk Action
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Print Label Modal State
  const [selectedPrintOrder, setSelectedPrintOrder] = useState<any | null>(null);

  // Active Picking & Packing Modal Orders
  const [packingOrder, setPackingOrder] = useState<any | null>(null);
  const [pickingOrder, setPickingOrder] = useState<any | null>(null);
  const [mainMode, setMainMode] = useState<"operations" | "errors" | "audit">("operations");

  const fetchOperations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        stage: stageTab,
        barcode: barcodeInput,
      });

      const res = await fetch(`/api/operations?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchOperations API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchOperations Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [page, limit, searchQuery, stageTab, barcodeInput]);

  // Handle Barcode Scan Submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    fetchOperations();
  };

  // Select All Checkbox Handler
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(orders.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Select Single Checkbox Handler
  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Execute WMS Bulk Action
  const handleExecuteBulkAction = async (action: string, targetStatus?: string) => {
    try {
      const res = await fetch("/api/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          targetStatus,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "WMS operation failed.");

      setSelectedIds([]);
      fetchOperations();
    } catch (err: any) {
      alert(`WMS Error: ${err.message}`);
    }
  };

  // Export CSV Handler
  const exportToCSV = () => {
    const itemsToExport = selectedIds.length > 0
      ? orders.filter((o) => selectedIds.includes(o.id))
      : orders;

    if (itemsToExport.length === 0) {
      alert("No WMS records available to export.");
      return;
    }

    const headers = [
      "Order ID",
      "Package ID",
      "Tracking Number",
      "Customer Name",
      "Customer City",
      "Shelf Bay Location",
      "Store Code",
      "Fulfillment Status",
      "Order Date",
    ];

    const rows = itemsToExport.map((o) => [
      `"${o.daraz_order_id}"`,
      `"${o.package_id || `PKG-${o.daraz_order_id}`}"`,
      `"${o.tracking_number || ""}"`,
      `"${(o.customer_name || "").replace(/"/g, '""')}"`,
      `"${o.customer_city || ""}"`,
      `"${o.shelf_location || "N/A"}"`,
      `"${o.daraz_stores?.store_code || ""}"`,
      `"${o.status || ""}"`,
      `"${new Date(o.order_date).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_WMS_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Warehouse Operations Center (WMS)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Enterprise picking, packing, shipping dispatch, barcode scanner station, and printable slips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export WMS CSV {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Warehouse Performance Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Orders Waiting</span>
          <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-200">{metrics.ordersWaiting}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Orders Picked</span>
          <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-200">{metrics.ordersPicked}</p>
        </div>

        <div className="rounded-2xl border border-purple-200/80 dark:border-purple-500/30 bg-purple-50/80 dark:bg-purple-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Orders Packed</span>
          <p className="mt-1 text-xl font-bold text-purple-900 dark:text-purple-200">{metrics.ordersPacked}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Orders Shipped</span>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">{metrics.ordersShipped}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Avg Processing</span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{metrics.avgProcessingTimeMinutes} min</p>
        </div>
      </div>

      {/* Barcode Scanner Input Station */}
      <div className="rounded-2xl border-2 border-orange-400/80 dark:border-orange-500/40 bg-orange-50/60 dark:bg-orange-500/10 p-4 shadow-apple space-y-2">
        <div className="flex items-center space-x-2">
          <Barcode className="h-5 w-5 text-orange-600 dark:text-orange-400 animate-pulse" />
          <h2 className="text-xs font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider">
            Automated Barcode Scanner Terminal
          </h2>
        </div>

        <form onSubmit={handleBarcodeSubmit} className="flex items-center space-x-2">
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan order barcode, tracking number, or SKU to auto-locate package..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-800 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white dark:bg-slate-950"
          />
          <button
            type="submit"
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all apple-press shadow-2xs shrink-0"
          >
            Scan & Find
          </button>
        </form>
      </div>

      {/* Pipeline Stage Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setStageTab("all");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            stageTab === "all" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Stages
        </button>

        <button
          onClick={() => {
            setStageTab("ready_to_pick");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            stageTab === "ready_to_pick" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Ready to Pick ({metrics.ordersWaiting})
        </button>

        <button
          onClick={() => {
            setStageTab("ready_to_pack");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            stageTab === "ready_to_pack" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Ready to Pack ({metrics.ordersPicked})
        </button>

        <button
          onClick={() => {
            setStageTab("ready_to_ship");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            stageTab === "ready_to_ship" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Ready to Ship ({metrics.ordersPacked})
        </button>

        <button
          onClick={() => {
            setStageTab("shipped");
            setPage(1);
          }}
          title="Filter handed to delivery"
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${
            stageTab === "shipped" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">4. Handed to Delivery</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {metrics.ordersShipped} orders
          </p>
        </button>
      </div>

      {/* Bulk Action Controls */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50/90 p-3 shadow-sm text-xs">
          <span className="font-bold text-orange-900">{selectedIds.length} order(s) chosen</span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExecuteBulkAction("pick", "pending")}
              title="Mark selected orders as collected"
              className="rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 transition-all"
            >
              Mark Collected
            </button>

            <button
              onClick={() => handleExecuteBulkAction("pack", "ready_to_ship")}
              title="Mark selected orders as packed"
              className="rounded-xl bg-blue-600 px-3 py-1.5 font-bold text-white hover:bg-blue-700 transition-all"
            >
              Mark Packed
            </button>

            <button
              onClick={() => handleExecuteBulkAction("ship", "shipped")}
              title="Mark selected orders as handed to delivery"
              className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 transition-all"
            >
              Mark Sent
            </button>
          </div>
        </div>
      )}

      {/* Warehouse Pipeline Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading warehouse orders...</span>
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={orders.length > 0 && selectedIds.length === orders.length}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Shelf Location</th>
                  <th className="px-4 py-3">Warehouse Stage</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {orders.map((ord) => {
                  const isSelected = selectedIds.includes(ord.id);
                  return (
                    <tr key={ord.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-orange-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(ord.id)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">#{ord.daraz_order_id}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{ord.customer_name || "Customer"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-orange-600">{ord.shelf_location || "N/A"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-xl font-bold text-[10px] capitalize border ${
                              ord.is_label_printed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : ord.is_packed
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {ord.is_label_printed
                              ? "✓ Label Printed"
                              : ord.is_packed
                              ? "Packed (Ready for Label)"
                              : "Ready to Pack"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {!ord.is_packed ? (
                          <button
                            onClick={() => setPackingOrder(ord)}
                            title="Open packing checklist and verify items"
                            className="inline-flex items-center space-x-1 border border-orange-300 bg-orange-50 hover:bg-orange-100 rounded-xl px-2.5 py-1 text-orange-800 font-bold transition-all apple-press"
                          >
                            <PackageCheck className="h-3.5 w-3.5 text-orange-600" />
                            <span>Pack Order</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedPrintOrder(ord)}
                            title="Print official Daraz shipping label"
                            className={`inline-flex items-center space-x-1 border rounded-xl px-2.5 py-1 font-bold transition-all apple-press ${
                              ord.is_label_printed
                                ? "border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700"
                                : "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                            }`}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>{ord.is_label_printed ? "Print Again" : "Print Label"}</span>
                          </button>
                        )}
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
            <p className="font-medium text-slate-700">No orders in the warehouse right now.</p>
            <p>New orders will appear here for picking and packing.</p>
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
              className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>

            <span className="text-slate-500 ml-2">
              Showing {orders.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} orders
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

      {/* Picking Modal */}
      {pickingOrder && (
        <PickingModal
          order={pickingOrder}
          onClose={() => setPickingOrder(null)}
          onPickingCompleted={() => fetchOperations()}
        />
      )}

      {/* Packing Modal */}
      {packingOrder && (
        <PackingModal
          order={packingOrder}
          onClose={() => setPackingOrder(null)}
          onOrderPacked={() => fetchOperations()}
          onOpenShippingLabel={(ord) => {
            setSelectedPrintOrder(ord);
          }}
        />
      )}

      {/* Official Shipping Label Printable Modal */}
      {selectedPrintOrder && (
        <PrintableLabelModal
          order={selectedPrintOrder}
          onClose={() => setSelectedPrintOrder(null)}
          onLabelPrinted={() => fetchOperations()}
        />
      )}
    </div>
  );
}
