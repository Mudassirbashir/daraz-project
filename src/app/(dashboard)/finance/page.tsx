"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { OrderProfitModal } from "@/components/finance/OrderProfitModal";
import {
  DollarSign,
  TrendingUp,
  PieChart,
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
  Building2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function FinancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Summary Metrics State
  const [summary, setSummary] = useState({
    totalRevenueCents: 0,
    totalProfitCents: 0,
    totalExpensesCents: 0,
    settledAmountCents: 0,
  });

  // Store Comparison State
  const [storeComparison, setStoreComparison] = useState<any[]>([]);

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
    store: true,
    price: true,
    cogs: true,
    commission: true,
    netProfit: true,
    marginPercentage: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Detail Modal State
  const [selectedProfitDetail, setSelectedProfitDetail] = useState<any | null>(null);

  const fetchStores = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("daraz_stores").select("id, store_code, store_name");
      setStores(data || []);
    } catch (err) {
      console.error("[FetchStores Error]:", err);
    }
  };

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        store_id: storeFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const res = await fetch(`/api/finance?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setRecords(data.records || []);
        if (data.summary) setSummary(data.summary);
        if (data.storeComparison) setStoreComparison(data.storeComparison);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchFinance API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchFinance Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchFinance();
  }, [page, limit, searchQuery, storeFilter, sortBy, sortOrder]);

  const exportToCSV = () => {
    if (records.length === 0) {
      alert("No financial records available to export.");
      return;
    }

    const headers = ["Product Code", "Product Name", "Store Code", "Sales (PKR)", "Cost (PKR)", "Fee (PKR)", "Profit (PKR)", "Margin %"];
    const rows = records.map((r) => [
      `"${r.seller_sku || ""}"`,
      `"${(r.title || "").replace(/"/g, '""')}"`,
      `"${r.store_code || ""}"`,
      (r.price_cents / 100).toFixed(2),
      (r.cogs_cents / 100).toFixed(2),
      (r.commission_cents / 100).toFixed(2),
      (r.net_profit_cents / 100).toFixed(2),
      `${r.margin_percentage}%`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Money_Summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const revenueFormatted = (summary.totalRevenueCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const profitFormatted = (summary.totalProfitCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const expensesFormatted = (summary.totalExpensesCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const bankFormatted = (summary.settledAmountCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Money</h1>
          <p className="text-xs text-slate-500">
            See your sales, store fees, product costs, and profit.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download financial summary as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Summary</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Total Sales</span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{revenueFormatted}</p>
          <span className="text-emerald-600 font-semibold">Gross customer sales</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Profit Kept</span>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700">{profitFormatted}</p>
          <span className="text-emerald-600 font-semibold">After product costs & fees</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Expenses & Fees</span>
            <PieChart className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700">{expensesFormatted}</p>
          <span className="text-amber-600 font-semibold">Product costs + store fees</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Money Coming to Bank</span>
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-700">{bankFormatted}</p>
          <span className="text-blue-600 font-semibold">Estimated bank payout</span>
        </div>
      </div>

      {/* Controls Bar */}
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
            placeholder="Search sales by product name or code..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
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

      {/* Money Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading sales and profit numbers...</span>
          </div>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  {columnVisibility.product && <th className="px-4 py-3">Product Name</th>}
                  {columnVisibility.sellerSku && <th className="px-4 py-3">Product Code</th>}
                  {columnVisibility.price && <th className="px-4 py-3">Sales</th>}
                  {columnVisibility.cogs && <th className="px-4 py-3">Product Cost</th>}
                  {columnVisibility.commission && <th className="px-4 py-3">Store Fee</th>}
                  {columnVisibility.netProfit && <th className="px-4 py-3">Profit Kept</th>}
                  {columnVisibility.marginPercentage && <th className="px-4 py-3">Margin %</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {records.map((r) => {
                  const rev = (r.price_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const cogs = (r.cogs_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const comm = (r.commission_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const prof = (r.net_profit_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      {columnVisibility.product && (
                        <td className="px-4 py-3 font-bold text-slate-900">{r.title}</td>
                      )}

                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{r.seller_sku}</td>
                      )}

                      {columnVisibility.price && (
                        <td className="px-4 py-3 font-bold text-slate-900">{rev}</td>
                      )}

                      {columnVisibility.cogs && (
                        <td className="px-4 py-3 text-slate-600 font-medium">{cogs}</td>
                      )}

                      {columnVisibility.commission && (
                        <td className="px-4 py-3 text-amber-700 font-semibold">{comm}</td>
                      )}

                      {columnVisibility.netProfit && (
                        <td className="px-4 py-3 font-bold text-emerald-700">{prof}</td>
                      )}

                      {columnVisibility.marginPercentage && (
                        <td className="px-4 py-3 font-bold text-slate-800">{r.margin_percentage}%</td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedProfitDetail(r)}
                          title="See calculation breakdown"
                          className="inline-flex items-center space-x-1 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-bold"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>See Calculation</span>
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
            <p className="font-medium text-slate-700">No sales data yet.</p>
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
              Showing {records.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
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

      {/* Order Profit Detail Breakdown Modal */}
      {selectedProfitDetail && (
        <OrderProfitModal
          record={selectedProfitDetail}
          onClose={() => setSelectedProfitDetail(null)}
        />
      )}
    </div>
  );
}
