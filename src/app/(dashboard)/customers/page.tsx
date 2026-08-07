"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { CustomerProfileModal } from "@/components/customers/CustomerProfileModal";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Download,
  Printer,
  Columns,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Award,
  RotateCcw,
  XCircle,
  CheckCircle2,
  DollarSign,
  Phone,
  MapPin
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Metrics
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    newCustomers: 0,
    returningCustomers: 0,
    highValueCustomers: 0,
    returnsCount: 0,
    refundAmountCents: 0,
    cancellationRatePercent: 0,
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    customer: true,
    phone: true,
    city: true,
    totalOrders: true,
    totalSpend: true,
    aov: true,
    delivered: true,
    returns: true,
    lastOrder: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Profile Modal State
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        filter_type: filterType,
      });

      const res = await fetch(`/api/customers?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setCustomers(data.customers || []);
        if (data.metrics) setMetrics(data.metrics);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchCustomers API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchCustomers Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, limit, searchQuery, filterType]);

  // Export CSV Handler
  const exportToCSV = () => {
    if (customers.length === 0) {
      alert("No customer records available to export.");
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "City",
      "Province",
      "Total Orders",
      "Total Spend (PKR)",
      "AOV (PKR)",
      "Delivered Orders",
      "Returned Orders",
      "First Order Date",
      "Last Order Date",
    ];

    const rows = customers.map((c) => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${c.phone || "N/A"}"`,
      `"${c.city || "N/A"}"`,
      `"${c.province || "Pakistan"}"`,
      c.ordersCount,
      (c.totalSpendCents / 100).toFixed(2),
      (c.aovCents / 100).toFixed(2),
      c.deliveredCount,
      c.returnedCount,
      `"${new Date(c.firstOrderDate).toLocaleString()}"`,
      `"${new Date(c.lastOrderDate).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Customers_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const refundFormatted = (metrics.refundAmountCents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Service & Returns Center</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Enterprise customer database, order histories, return tracking, and cancellation diagnostics.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>PDF Report</span>
          </button>

          <button
            onClick={exportToCSV}
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Enterprise Dashboard Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Customers</span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{metrics.totalCustomers}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">New Customers</span>
          <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.newCustomers}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Repeat Buyers</span>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">{metrics.returningCustomers}</p>
        </div>

        <div className="rounded-2xl border border-purple-200/80 dark:border-purple-500/30 bg-purple-50/80 dark:bg-purple-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">High Value VIP</span>
          <p className="mt-1 text-xl font-bold text-purple-900 dark:text-purple-200">{metrics.highValueCustomers}</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Returns</span>
          <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-200">{metrics.returnsCount}</p>
        </div>

        <div className="rounded-2xl border border-red-200/80 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Refund Amount</span>
          <p className="mt-1 text-xl font-bold text-red-900 dark:text-red-200">{refundFormatted}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3.5 shadow-apple">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cancellation Rate</span>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{metrics.cancellationRatePercent}%</p>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setFilterType("all");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            filterType === "all" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Customers ({metrics.totalCustomers})
        </button>

        <button
          onClick={() => {
            setFilterType("repeat");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            filterType === "repeat" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Repeat Customers ({metrics.returningCustomers})
        </button>

        <button
          onClick={() => {
            setFilterType("high_value");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            filterType === "high_value" ? "bg-purple-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          High Value VIP ({metrics.highValueCustomers})
        </button>

        <button
          onClick={() => {
            setFilterType("returned");
            setPage(1);
          }}
          className={`px-3.5 py-1.5 font-bold rounded-xl transition-all apple-press ${
            filterType === "returned" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Returned Orders ({metrics.returnsCount})
        </button>
      </div>

      {/* Controls Bar: Search, Columns */}
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
            placeholder="Search customers by Name, Phone Number, City, or Order ID..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Column Visibility Dropdown */}
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

      {/* Customer Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Aggregating customer order database...</span>
          </div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columnVisibility.customer && <th className="px-4 py-3">Customer Name</th>}
                  {columnVisibility.phone && <th className="px-4 py-3">Phone</th>}
                  {columnVisibility.city && <th className="px-4 py-3">City</th>}
                  {columnVisibility.totalOrders && <th className="px-4 py-3">Total Orders</th>}
                  {columnVisibility.totalSpend && <th className="px-4 py-3">Total Spend</th>}
                  {columnVisibility.aov && <th className="px-4 py-3">AOV</th>}
                  {columnVisibility.delivered && <th className="px-4 py-3">Delivered</th>}
                  {columnVisibility.returns && <th className="px-4 py-3">Returns</th>}
                  {columnVisibility.lastOrder && <th className="px-4 py-3">Last Order Date</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {customers.map((c) => {
                  const totalSpend = (c.totalSpendCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const aov = (c.aovCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {columnVisibility.customer && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                          {c.isHighValue && (
                            <span className="inline-flex items-center space-x-1 rounded bg-purple-50 dark:bg-purple-500/10 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 dark:text-purple-400 border border-purple-200/80 dark:border-purple-500/20">
                              <Award className="h-2.5 w-2.5" />
                              <span>VIP</span>
                            </span>
                          )}
                        </td>
                      )}

                      {columnVisibility.phone && (
                        <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300">{c.phone}</td>
                      )}

                      {columnVisibility.city && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{c.city}</td>
                      )}

                      {columnVisibility.totalOrders && (
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.ordersCount}</td>
                      )}

                      {columnVisibility.totalSpend && (
                        <td className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400">{totalSpend}</td>
                      )}

                      {columnVisibility.aov && (
                        <td className="px-4 py-3 text-blue-700 dark:text-blue-400 font-semibold">{aov}</td>
                      )}

                      {columnVisibility.delivered && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.deliveredCount}</td>
                      )}

                      {columnVisibility.returns && (
                        <td className="px-4 py-3 text-amber-700 dark:text-amber-400 font-bold">{c.returnedCount}</td>
                      )}

                      {columnVisibility.lastOrder && (
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(c.lastOrderDate).toLocaleString()}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedCustomerProfile(c)}
                          className="inline-flex items-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all apple-press shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Profile</span>
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
            <p className="font-medium text-slate-700 dark:text-slate-300">No customers found matching your current filter.</p>
            <p>Click "Sync Now" above to sync live customer orders from Daraz Open Platform.</p>
          </div>
        )}

        {/* Pagination Footer */}
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
              Showing {customers.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} customers
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

      {/* Customer Profile Modal */}
      {selectedCustomerProfile && (
        <CustomerProfileModal
          customer={selectedCustomerProfile}
          onClose={() => setSelectedCustomerProfile(null)}
        />
      )}
    </div>
  );
}
