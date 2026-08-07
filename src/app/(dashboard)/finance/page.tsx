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
  Building2,
  Receipt,
  Percent,
  Copy,
  Check
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
    netProfitCents: 0,
    todaysRevenueCents: 0,
    todaysProfitCents: 0,
    pendingSettlementCents: 0,
    settledAmountCents: 0,
    cancelledLossCents: 0,
    returnedLossCents: 0,
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
    shippingFee: true,
    totalExpenses: true,
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

  // Export CSV Handler
  const exportToCSV = () => {
    if (records.length === 0) {
      alert("No financial records available to export.");
      return;
    }

    const headers = [
      "Seller SKU",
      "Product Name",
      "Store Code",
      "Store Name",
      "Revenue (PKR)",
      "COGS (PKR)",
      "Daraz Commission (PKR)",
      "Payment Fee (PKR)",
      "Shipping Fee (PKR)",
      "Total Expenses (PKR)",
      "Net Profit (PKR)",
      "Margin %",
    ];

    const rows = records.map((r) => [
      `"${r.seller_sku || ""}"`,
      `"${(r.title || "").replace(/"/g, '""')}"`,
      `"${r.store_code || ""}"`,
      `"${r.store_name || ""}"`,
      (r.price_cents / 100).toFixed(2),
      (r.cogs_cents / 100).toFixed(2),
      (r.commission_cents / 100).toFixed(2),
      (r.payment_fee_cents / 100).toFixed(2),
      (r.shipping_fee_cents / 100).toFixed(2),
      (r.total_expenses_cents / 100).toFixed(2),
      (r.net_profit_cents / 100).toFixed(2),
      `${r.margin_percentage}%`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Finance_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const totalRevFormatted = (summary.totalRevenueCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const totalProfitFormatted = (summary.totalProfitCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const totalExpFormatted = (summary.totalExpensesCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
  const settledFormatted = (summary.settledAmountCents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

  return (
    <div className="space-y-6">
      {/* Header & Print/Export Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance & Profit Analytics ERP</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Real-time profit & loss margin calculations, marketplace commissions, logistics fees, and multi-store financial comparisons.
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

      {/* Financial Summary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Gross Catalog Revenue</span>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalRevFormatted}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 p-4 shadow-apple">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Net Settled Profit</span>
          <p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-200">{totalProfitFormatted}</p>
        </div>

        <div className="rounded-2xl border border-red-200/80 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 p-4 shadow-apple">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Total Operating Expenses</span>
          <p className="mt-1 text-2xl font-bold text-red-900 dark:text-red-200">{totalExpFormatted}</p>
        </div>

        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 p-4 shadow-apple">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Settled Payout Estimate</span>
          <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-200">{settledFormatted}</p>
        </div>
      </div>

      {/* Store Comparison Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-orange-500" />
          <span>Multi-Store Financial Performance Comparison</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {storeComparison.map((st, idx) => {
            const rev = (st.revenue_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
            const prof = (st.profit_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

            return (
              <div key={idx} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{st.store_name}</span>
                  <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">{st.store_code}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Revenue:</span>
                    <p className="font-bold text-slate-900 dark:text-white">{rev}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Net Profit:</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{prof}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
            placeholder="Search financial records by Seller SKU, Product Name, or Daraz Item ID..."
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
              <option value="price_cents:desc">Revenue: High to Low</option>
              <option value="price_cents:asc">Revenue: Low to High</option>
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

      {/* Financial Records Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Calculating live financial metrics...</span>
          </div>
        ) : records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columnVisibility.product && <th className="px-4 py-3">Product Name</th>}
                  {columnVisibility.sellerSku && <th className="px-4 py-3">Seller SKU</th>}
                  {columnVisibility.store && <th className="px-4 py-3">Store</th>}
                  {columnVisibility.price && <th className="px-4 py-3">Selling Revenue</th>}
                  {columnVisibility.cogs && <th className="px-4 py-3">COGS</th>}
                  {columnVisibility.commission && <th className="px-4 py-3">Commission</th>}
                  {columnVisibility.shippingFee && <th className="px-4 py-3">Shipping Fee</th>}
                  {columnVisibility.totalExpenses && <th className="px-4 py-3">Total Expenses</th>}
                  {columnVisibility.netProfit && <th className="px-4 py-3">Net Profit</th>}
                  {columnVisibility.marginPercentage && <th className="px-4 py-3">Margin %</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {records.map((r) => {
                  const rev = (r.price_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const cogs = (r.cogs_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const comm = (r.commission_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const shp = (r.shipping_fee_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const exp = (r.total_expenses_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });
                  const prof = (r.net_profit_cents / 100).toLocaleString("en-PK", { style: "currency", currency: "PKR" });

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      {columnVisibility.product && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{r.title}</p>
                          <span className="text-[10px] text-slate-400 font-mono">Item ID: {r.item_id}</span>
                        </td>
                      )}

                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{r.seller_sku}</td>
                      )}

                      {columnVisibility.store && (
                        <td className="px-4 py-3">
                          <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {r.store_name}
                          </span>
                        </td>
                      )}

                      {columnVisibility.price && (
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{rev}</td>
                      )}

                      {columnVisibility.cogs && (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{cogs}</td>
                      )}

                      {columnVisibility.commission && (
                        <td className="px-4 py-3 text-red-600 dark:text-red-400 font-semibold">{comm}</td>
                      )}

                      {columnVisibility.shippingFee && (
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{shp}</td>
                      )}

                      {columnVisibility.totalExpenses && (
                        <td className="px-4 py-3 text-red-700 dark:text-red-400 font-bold">{exp}</td>
                      )}

                      {columnVisibility.netProfit && (
                        <td className={`px-4 py-3 font-bold ${r.net_profit_cents > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {prof}
                        </td>
                      )}

                      {columnVisibility.marginPercentage && (
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-xl font-bold text-[11px] ${r.margin_percentage > 20 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20" : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20"}`}>
                            {r.margin_percentage}%
                          </span>
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedProfitDetail(r)}
                          className="inline-flex items-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all apple-press shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>Breakdown</span>
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
            <p className="font-medium text-slate-700 dark:text-slate-300">No financial records found matching your current filter.</p>
            <p>Click "Sync Now" above to calculate live product margins from Daraz Open Platform.</p>
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
              Showing {records.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
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
