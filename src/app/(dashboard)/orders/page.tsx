"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { OrderDetailsModal } from "@/components/orders/OrderDetailsModal";
import {
  ShoppingCart,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Clock,
  Truck,
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
  DollarSign,
  PackageCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Dashboard Metrics
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    pending: 0,
    readyToShip: 0,
    shipped: 0,
    delivered: 0,
    canceled: 0,
    returned: 0,
    failed: 0,
    todaysOrders: 0,
    todaysRevenueCents: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stores List
  const [stores, setStores] = useState<any[]>([]);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    orderId: true,
    packageId: true,
    customer: true,
    phone: true,
    city: true,
    status: true,
    payment: true,
    amount: true,
    shipping: true,
    tracking: true,
    createdDate: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Copy Feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Detail Modal state
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);

  const fetchStores = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("daraz_stores").select("id, store_code, store_name");
      setStores(data || []);
    } catch (err) {
      console.error("[FetchStores Error]:", err);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        status: statusFilter,
        store_id: storeFilter,
        city: cityFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
        if (data.metrics) setMetrics(data.metrics);
        setTotalOrders(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
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
    fetchStores();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [page, limit, searchQuery, statusFilter, storeFilter, cityFilter, sortBy, sortOrder]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Export CSV Handler
  const exportToCSV = () => {
    if (orders.length === 0) {
      alert("No orders available to export.");
      return;
    }

    const headers = [
      "Order ID",
      "Package ID",
      "Customer Name",
      "Customer Phone",
      "City",
      "Store Code",
      "Store Name",
      "Total Amount (PKR)",
      "Status",
      "Tracking Number",
      "Order Date",
    ];

    const rows = orders.map((o) => [
      `"${o.daraz_order_id}"`,
      `"${o.package_id || `PKG-${o.daraz_order_id}`}"`,
      `"${(o.customer_name || "").replace(/"/g, '""')}"`,
      `"${o.customer_phone || ""}"`,
      `"${o.customer_city || ""}"`,
      `"${o.daraz_stores?.store_code || ""}"`,
      `"${o.daraz_stores?.store_name || ""}"`,
      (o.total_amount_cents / 100).toFixed(2),
      `"${o.status || ""}"`,
      `"${o.tracking_number || ""}"`,
      `"${new Date(o.order_date).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Orders_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (["pending", "unpaid"].includes(s)) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20">
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>Pending</span>
        </span>
      );
    }
    if (s === "ready_to_ship") {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
          <PackageCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span>Ready to Ship</span>
        </span>
      );
    }
    if (s === "shipped") {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/20">
          <Truck className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          <span>Shipped</span>
        </span>
      );
    }
    if (s === "delivered") {
      return (
        <span className="inline-flex items-center space-x-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20">
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>Delivered</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 rounded-xl bg-red-50 dark:bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-500/20">
        <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
        <span>Cancelled</span>
      </span>
    );
  };

  const todaysRevenueFormatted = (metrics.todaysRevenueCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daraz Seller Center — Orders ERP</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Real-time customer orders, fulfillment tracking, financial payouts, column visibility, and CSV exports.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Orders CSV</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Daraz Seller Center Dashboard Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Orders</span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{metrics.totalOrders}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending</span>
          <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{metrics.pending}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ready to Ship</span>
          <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.readyToShip}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Delivered</span>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.delivered}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cancelled / Failed</span>
          <p className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{metrics.canceled + metrics.failed}</p>
        </div>

        <div className="rounded-2xl border border-orange-200/80 dark:border-orange-500/30 bg-orange-50/80 dark:bg-orange-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">Today's Revenue</span>
          <p className="mt-1 text-xl font-bold text-orange-900 dark:text-orange-200">{todaysRevenueFormatted}</p>
        </div>
      </div>

      {/* Status Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "all" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Orders ({metrics.totalOrders})
        </button>

        <button
          onClick={() => {
            setStatusFilter("pending");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "pending" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Pending ({metrics.pending})
        </button>

        <button
          onClick={() => {
            setStatusFilter("ready_to_ship");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "ready_to_ship" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Ready to Ship ({metrics.readyToShip})
        </button>

        <button
          onClick={() => {
            setStatusFilter("delivered");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "delivered" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Delivered ({metrics.delivered})
        </button>

        <button
          onClick={() => {
            setStatusFilter("canceled");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "canceled" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Cancelled ({metrics.canceled + metrics.failed})
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
            placeholder="Search orders by Order ID, Package ID, Tracking Number, Customer Name, or Phone..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Store Filter */}
          <div className="flex items-center space-x-1.5 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stores</option>
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
              <option value="order_date:desc">Newest Orders First</option>
              <option value="order_date:asc">Oldest Orders First</option>
              <option value="total_amount_cents:desc">Amount: High to Low</option>
              <option value="total_amount_cents:asc">Amount: Low to High</option>
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

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Querying live Daraz orders catalog...</span>
          </div>
        ) : orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columnVisibility.orderId && <th className="px-4 py-3">Order ID</th>}
                  {columnVisibility.packageId && <th className="px-4 py-3">Package ID</th>}
                  {columnVisibility.customer && <th className="px-4 py-3">Customer & City</th>}
                  {columnVisibility.phone && <th className="px-4 py-3">Phone</th>}
                  {columnVisibility.amount && <th className="px-4 py-3">Amount</th>}
                  {columnVisibility.payment && <th className="px-4 py-3">Payment</th>}
                  {columnVisibility.shipping && <th className="px-4 py-3">Shipping Provider</th>}
                  {columnVisibility.tracking && <th className="px-4 py-3">Tracking Number</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Status</th>}
                  {columnVisibility.createdDate && <th className="px-4 py-3">Order Date</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {orders.map((ord) => {
                  const amountFormatted = (ord.total_amount_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {columnVisibility.orderId && (
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center space-x-1">
                            <span className="font-bold text-slate-900 dark:text-white">#{ord.daraz_order_id}</span>
                            <button
                              onClick={() => copyToClipboard(ord.daraz_order_id, ord.id + "_ord")}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Copy Order ID"
                            >
                              {copiedField === ord.id + "_ord" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400">{ord.daraz_stores?.store_name}</span>
                        </td>
                      )}

                      {columnVisibility.packageId && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                          {ord.package_id || `PKG-${ord.daraz_order_id.slice(-6)}`}
                        </td>
                      )}

                      {columnVisibility.customer && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{ord.customer_name || "Customer"}</p>
                          <p className="text-[11px] text-slate-400">{ord.customer_city || "Pakistan"}</p>
                        </td>
                      )}

                      {columnVisibility.phone && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{ord.customer_phone || "N/A"}</td>
                      )}

                      {columnVisibility.amount && (
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{amountFormatted}</td>
                      )}

                      {columnVisibility.payment && (
                        <td className="px-4 py-3">
                          <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                            {ord.payment_method || "COD"}
                          </span>
                        </td>
                      )}

                      {columnVisibility.shipping && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                          {ord.shipping_provider || "DEX"}
                        </td>
                      )}

                      {columnVisibility.tracking && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                          <div className="flex items-center space-x-1">
                            <span>{ord.tracking_number || "Pending"}</span>
                            {ord.tracking_number && (
                              <button
                                onClick={() => copyToClipboard(ord.tracking_number, ord.id + "_trkn")}
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                                title="Copy Tracking Number"
                              >
                                {copiedField === ord.id + "_trkn" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {columnVisibility.status && (
                        <td className="px-4 py-3">{getStatusBadge(ord.status)}</td>
                      )}

                      {columnVisibility.createdDate && (
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(ord.order_date).toLocaleString()}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrderDetail(ord)}
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
            <p className="font-medium text-slate-700 dark:text-slate-300">No orders found matching your current filter.</p>
            <p>Click "Sync Now" above to pull live orders from Daraz Open Platform.</p>
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
              Showing {orders.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalOrders)} of {totalOrders} orders
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

      {/* Order Detail Modal */}
      {selectedOrderDetail && (
        <OrderDetailsModal
          order={selectedOrderDetail}
          onClose={() => setSelectedOrderDetail(null)}
        />
      )}
    </div>
  );
}
