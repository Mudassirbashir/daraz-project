"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { OrderDetailsModal } from "@/components/orders/OrderDetailsModal";
import { PackingModal } from "@/components/operations/PackingModal";
import { PrintableLabelModal } from "@/components/operations/PrintableLabelModal";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  AlertCircle,
  Download,
  Columns,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Metrics
  const [metrics, setMetrics] = useState({
    pending: 0,
    shipped: 0,
    delivered: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    orderId: true,
    customer: true,
    amount: true,
    status: true,
    tracking: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [packingOrder, setPackingOrder] = useState<any | null>(null);
  const [printOrder, setPrintOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        status: statusFilter,
      });

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
        setTotalItems(data.pagination?.total || (data.orders || []).length);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        console.error("[FetchOrders API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchOrders Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, limit, searchQuery, statusFilter]);

  const exportToCSV = () => {
    if (orders.length === 0) {
      alert("No orders available to export.");
      return;
    }

    const headers = ["Order ID", "Customer Name", "Total Amount (PKR)", "Status", "Tracking Number"];
    const rows = orders.map((o) => [
      `"${o.daraz_order_id || o.id.slice(0, 8)}"`,
      `"${(o.customer_name || "Daraz Customer").replace(/"/g, '""')}"`,
      ((o.total_amount_cents || 0) / 100).toFixed(2),
      o.order_status || "Pending",
      `"${o.tracking_number || "N/A"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Orders_List_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-xs text-slate-500">
            See what customers ordered and track package deliveries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download orders list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Orders List</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 text-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">All Orders</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalItems} orders</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Waiting to Send</span>
          <p className="mt-1 text-2xl font-bold text-amber-700">{metrics.pending || 0} orders</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">On the Way</span>
          <p className="mt-1 text-2xl font-bold text-blue-700">{metrics.shipped || 0} orders</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Delivered</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{metrics.delivered || 0} orders</p>
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
            placeholder="Search orders by order number or customer..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">All Orders</option>
            <option value="pending">Waiting to Send</option>
            <option value="shipped">On the Way</option>
            <option value="delivered">Delivered</option>
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Choose which columns to show"
              className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-3 py-2 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-30 space-y-2 text-xs">
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

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading orders...</span>
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.orderId && <th className="px-4 py-3">Order Number</th>}
                  {columnVisibility.customer && <th className="px-4 py-3">Customer</th>}
                  {columnVisibility.amount && <th className="px-4 py-3">Order Total</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Status</th>}
                  {columnVisibility.tracking && <th className="px-4 py-3">Tracking Number</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {orders.map((o) => {
                  const amountFormatted = ((o.total_amount_cents || 0) / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.orderId && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">#{o.daraz_order_id || o.id.slice(0, 8)}</td>
                      )}

                      {columnVisibility.customer && (
                        <td className="px-4 py-3 font-bold text-slate-800">{o.customer_name || "Daraz Customer"}</td>
                      )}

                      {columnVisibility.amount && (
                        <td className="px-4 py-3 font-bold text-slate-900">{amountFormatted}</td>
                      )}

                      {columnVisibility.status && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            (o.status || o.workflow_status) === "pending" || (o.status || o.workflow_status) === "unpaid"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : (o.status || o.workflow_status) === "shipped" || (o.status || o.workflow_status) === "ready_to_ship"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : (o.status || o.workflow_status) === "delivered"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-800 border border-slate-200"
                          }`}>
                            {(o.status || o.workflow_status || "pending").replace(/_/g, " ")}
                          </span>
                        </td>
                      )}

                      {columnVisibility.tracking && (
                        <td className="px-4 py-3 font-mono text-slate-600">{o.tracking_number || o.daraz_order_id || "N/A"}</td>
                      )}

                      <td className="px-4 py-3 text-right space-x-1.5">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          title="View complete order details and items"
                          className="inline-flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => setPrintOrder(o)}
                          title="Print Official Shipping Label"
                          className="inline-flex items-center space-x-1 border border-orange-200 bg-orange-50 rounded-lg px-2.5 py-1 text-orange-700 hover:bg-orange-100 font-bold"
                        >
                          <Package className="h-3.5 w-3.5 text-orange-600" />
                          <span>Label</span>
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
            <p className="font-medium text-slate-700">No orders yet. For now, you're all caught up.</p>
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
              Showing {orders.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} orders
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOpenPackingModal={(ord) => setPackingOrder(ord)}
          onOpenPrintModal={(ord) => setPrintOrder(ord)}
        />
      )}

      {/* Packing Modal */}
      {packingOrder && (
        <PackingModal
          order={packingOrder}
          onClose={() => setPackingOrder(null)}
          onOrderPacked={() => fetchOrders()}
          onOpenShippingLabel={(ord) => setPrintOrder(ord)}
        />
      )}

      {/* Official Shipping Label Printable Modal */}
      {printOrder && (
        <PrintableLabelModal
          order={printOrder}
          onClose={() => setPrintOrder(null)}
          onLabelPrinted={() => fetchOrders()}
        />
      )}
    </div>
  );
}
