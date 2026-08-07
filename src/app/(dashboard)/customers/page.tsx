"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { CustomerProfileModal } from "@/components/customers/CustomerProfileModal";
import {
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Download,
  Printer,
  Columns,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Metrics
  const [metrics, setMetrics] = useState<any>({
    totalCustomers: 0,
    totalRevenueCents: 0,
    avgOrderValueCents: 0,
    repeatRate: "0%",
  });

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Column Visibility State
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    phone: true,
    ordersCount: true,
    totalSpend: true,
    returnsCount: true,
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

  const exportToCSV = () => {
    if (customers.length === 0) {
      alert("No customer records available to export.");
      return;
    }

    const headers = ["Customer Name", "Phone", "Total Orders", "Total Spend (PKR)", "Returns"];
    const rows = customers.map((c) => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${c.phone || "N/A"}"`,
      c.ordersCount || 1,
      ((c.totalSpendCents || 0) / 100).toFixed(2),
      c.returnedCount || 0,
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

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers & Returns</h1>
          <p className="text-xs text-slate-500">
            See your buyers, repeat orders, and customer returns.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download customer list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Customers List</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 text-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Customers</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalCustomers || 0} buyers</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Sales</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
            {((metrics.totalRevenueCents || 0) / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" })}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Average Order Amount</span>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {((metrics.avgOrderValueCents || 0) / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" })}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Returning Customers</span>
          <p className="mt-1 text-2xl font-bold text-purple-700">{metrics.repeatRate || "0%"} repeat</p>
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
            placeholder="Search customers by name or phone..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Column Selector */}
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

      {/* Customers Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading customers...</span>
          </div>
        ) : customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.name && <th className="px-4 py-3">Customer Name</th>}
                  {columnVisibility.phone && <th className="px-4 py-3">Phone</th>}
                  {columnVisibility.ordersCount && <th className="px-4 py-3">Orders Made</th>}
                  {columnVisibility.totalSpend && <th className="px-4 py-3">Total Bought</th>}
                  {columnVisibility.returnsCount && <th className="px-4 py-3">Returns</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {customers.map((c) => {
                  const spendFormatted = ((c.totalSpendCents || 0) / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.name && (
                        <td className="px-4 py-3 font-bold text-slate-900">{c.name}</td>
                      )}

                      {columnVisibility.phone && (
                        <td className="px-4 py-3 font-mono text-slate-600">{c.phone || "N/A"}</td>
                      )}

                      {columnVisibility.ordersCount && (
                        <td className="px-4 py-3 font-bold text-slate-800">{c.ordersCount || 1} orders</td>
                      )}

                      {columnVisibility.totalSpend && (
                        <td className="px-4 py-3 font-bold text-emerald-700">{spendFormatted}</td>
                      )}

                      {columnVisibility.returnsCount && (
                        <td className="px-4 py-3 font-bold text-slate-600">{c.returnedCount || 0} returned</td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedCustomerProfile(c)}
                          title="View customer purchase history"
                          className="inline-flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>See Buyer History</span>
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
            <p className="font-medium text-slate-700">No customers yet.</p>
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
              Showing {customers.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalItems)} of {totalItems} customers
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
