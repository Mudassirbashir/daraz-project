"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { BulkEditModal } from "@/components/products/BulkEditModal";
import {
  Package,
  Search,
  Tag,
  Filter,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Eye,
  Edit3,
  SlidersHorizontal,
  Layers,
  Power
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ListingsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeFilter, setStoreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stores filter list
  const [stores, setStores] = useState<any[]>([]);

  // Selection & Bulk Action state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"price" | "stock" | null>(null);

  // Product detail modal state
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);

  const fetchStores = async () => {
    try {
      const supabase = createClient();
      const { data } = await (supabase as any).from("daraz_stores").select("id, store_code, store_name");
      setStores(data || []);
    } catch (err) {
      console.error("[FetchStores Error]:", err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: searchQuery,
        status: statusFilter,
        store_id: storeFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.products || []);
        setTotalProducts(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error("[FetchProducts API Error]:", data.error);
      }
    } catch (err: any) {
      console.error("[FetchProducts Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, limit, searchQuery, statusFilter, storeFilter, sortBy, sortOrder]);

  // Handle Select All
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Handle Individual Selection
  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Execute Bulk Action API
  const handleExecuteBulkAction = async (action: string, value?: string) => {
    try {
      const res = await fetch("/api/products/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
          value,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Bulk action failed.");
      }

      setSelectedIds([]);
      fetchProducts();
    } catch (err: any) {
      alert(`Bulk Action Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sync */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daraz Seller Center — Products Management</h1>
          <p className="text-xs text-slate-500">
            Real-time catalog, SKU variants, prices, inventory levels, and bulk operational controls synchronized with Daraz.
          </p>
        </div>
        <SyncNowButton />
      </div>

      {/* Metrics Header Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500">Total Products</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalProducts} SKUs</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500">In Stock</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {products.filter((p) => p.stock_quantity > 0).length} Available
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500">Out of Stock</span>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {products.filter((p) => p.stock_quantity === 0).length} Items
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-500">Selected for Bulk Action</span>
          <p className="mt-1 text-2xl font-bold text-orange-600">{selectedIds.length} Selected</p>
        </div>
      </div>

      {/* Status Filter Tabs (Daraz Seller Center Style) */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => {
            setStatusFilter("all");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            statusFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Products
        </button>

        <button
          onClick={() => {
            setStatusFilter("active");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            statusFilter === "active" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Active / In Stock
        </button>

        <button
          onClick={() => {
            setStatusFilter("low_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            statusFilter === "low_stock" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Low Stock (&le; 10)
        </button>

        <button
          onClick={() => {
            setStatusFilter("out_of_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            statusFilter === "out_of_stock" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Out of Stock (0)
        </button>
      </div>

      {/* Controls Bar: Search, Store Filter, Sorting */}
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
            placeholder="Search products by Title, Seller SKU, or Daraz Item ID..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Store Filter */}
          <div className="flex items-center space-x-1.5 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={storeFilter}
              onChange={(e) => {
                setStoreFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
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
              <option value="created_at:desc">Newest First</option>
              <option value="title:asc">Name (A-Z)</option>
              <option value="price_cents:asc">Price: Low to High</option>
              <option value="price_cents:desc">Price: High to Low</option>
              <option value="stock_quantity:desc">Stock: High to Low</option>
              <option value="stock_quantity:asc">Stock: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar (Sticky when items selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-3 shadow-md">
          <span className="text-xs font-bold text-orange-900">
            {selectedIds.length} product(s) selected for bulk operations
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBulkAction("price")}
              className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all shadow-sm"
            >
              Edit Bulk Price
            </button>

            <button
              onClick={() => setBulkAction("stock")}
              className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all shadow-sm"
            >
              Edit Bulk Stock
            </button>

            <button
              onClick={() => handleExecuteBulkAction("activate")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all shadow-sm"
            >
              Activate
            </button>

            <button
              onClick={() => handleExecuteBulkAction("deactivate")}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-sm"
            >
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Querying Daraz product catalog...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={products.length > 0 && selectedIds.length === products.length}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3">Product Title & SKU</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Daraz Item ID</th>
                  <th className="px-4 py-3">Price (PKR)</th>
                  <th className="px-4 py-3">Stock Level</th>
                  <th className="px-4 py-3">Sync Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((item) => {
                  const priceFormatted = (item.price_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  const specialPriceFormatted = item.special_price_cents
                    ? (item.special_price_cents / 100).toLocaleString("en-PK", {
                        style: "currency",
                        currency: "PKR",
                      })
                    : null;

                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/50 transition-colors ${isSelected ? "bg-orange-50/30" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(item.id)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                            {item.images && item.images.length > 0 ? (
                              <img src={item.images[0]} alt={item.title} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                            <p className="font-mono text-[11px] text-slate-500">SKU: {item.seller_sku}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-700">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                          {item.daraz_stores?.store_name || "Daraz Store"}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        {item.daraz_item_id || item.daraz_sku_id || "N/A"}
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{priceFormatted}</p>
                        {specialPriceFormatted && (
                          <p className="text-[10px] font-semibold text-emerald-600">Special: {specialPriceFormatted}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.stock_quantity > 10
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.stock_quantity > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {item.stock_quantity} Units
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                          <CheckCircle2 className="h-3 w-3 text-blue-600" />
                          <span>Synced</span>
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedProductDetail(item)}
                          className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>View</span>
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
            <p className="font-medium text-slate-700">No products found matching your current filter.</p>
            <p>Click "Sync Now" above to pull live product catalog items from Daraz Open Platform.</p>
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
            </select>

            <span className="text-slate-500 ml-2">
              Showing {products.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalProducts)} of {totalProducts} items
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

      {/* Product Detail Modal */}
      {selectedProductDetail && (
        <ProductDetailModal
          product={selectedProductDetail}
          onClose={() => setSelectedProductDetail(null)}
        />
      )}

      {/* Bulk Action Edit Modal */}
      {bulkAction && (
        <BulkEditModal
          action={bulkAction}
          selectedCount={selectedIds.length}
          onClose={() => setBulkAction(null)}
          onConfirm={(val) => handleExecuteBulkAction(bulkAction, val)}
        />
      )}
    </div>
  );
}
