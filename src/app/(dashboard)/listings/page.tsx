"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { ProductDetailModal } from "@/components/products/ProductDetailModal";
import { getStoreDisplayName } from "@/lib/daraz/store-utils";
import { BulkEditModal } from "@/components/products/BulkEditModal";
import { ProductImage } from "@/components/products/ProductImage";
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
  Download,
  Columns,
  Layers,
  CheckSquare,
  Square
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

  // Stores list
  const [stores, setStores] = useState<any[]>([]);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    image: true,
    title: true,
    sellerSku: true,
    darazSku: true,
    itemId: true,
    category: true,
    brand: true,
    price: true,
    specialPrice: true,
    stock: true,
    reservedStock: true,
    status: true,
    lastUpdated: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Selection & Bulk Action state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"price" | "stock" | null>(null);

  // Product detail modal state
  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);

  const fetchStores = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from("daraz_stores").select("id, store_code, store_name");
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

  // Select All Checkbox Handler
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(products.map((p) => p.id));
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
      if (!data.success) throw new Error(data.error || "Bulk action failed.");

      setSelectedIds([]);
      fetchProducts();
    } catch (err: any) {
      alert(`Bulk Action Error: ${err.message}`);
    }
  };

  // Export CSV Handler
  const exportToCSV = () => {
    const itemsToExport = selectedIds.length > 0
      ? products.filter((p) => selectedIds.includes(p.id))
      : products;

    if (itemsToExport.length === 0) {
      alert("No products available to export.");
      return;
    }

    const headers = [
      "Store Code",
      "Store Name",
      "Title",
      "Seller SKU",
      "Daraz SKU ID",
      "Daraz Item ID",
      "Price (PKR)",
      "Special Price (PKR)",
      "Stock Quantity",
      "Synced Status",
      "Last Synced At",
    ];

    const rows = itemsToExport.map((p) => [
      `"${p.daraz_stores?.store_code || ""}"`,
      `"${getStoreDisplayName(p.daraz_stores)}"`,
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${p.seller_sku || ""}"`,
      `"${p.daraz_sku_id || ""}"`,
      `"${p.daraz_item_id || ""}"`,
      (p.price_cents / 100).toFixed(2),
      p.special_price_cents ? (p.special_price_cents / 100).toFixed(2) : "",
      p.stock_quantity,
      p.is_synced ? "Synced" : "Pending",
      `"${p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daraz_Products_Export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Products</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            See and manage all your products across all connected stores.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={exportToCSV}
            title="Download your product list as a CSV file"
            className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 transition-all apple-press"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download List {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}</span>
          </button>

          <SyncNowButton />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">All Products</span>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalProducts} products</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">In Stock</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {products.filter((p) => p.stock_quantity > 0).length} available
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Out of Stock</span>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
            {products.filter((p) => p.stock_quantity === 0).length} empty
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 shadow-apple transition-all duration-200 hover:shadow-apple-hover">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected Products</span>
          <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">{selectedIds.length} chosen</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
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
          All Products ({totalProducts})
        </button>

        <button
          onClick={() => {
            setStatusFilter("active");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "active" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          In Stock
        </button>

        <button
          onClick={() => {
            setStatusFilter("low_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "low_stock" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Low Stock (&le; 10)
        </button>

        <button
          onClick={() => {
            setStatusFilter("out_of_stock");
            setPage(1);
          }}
          className={`px-4 py-2 font-bold rounded-xl transition-all apple-press ${
            statusFilter === "out_of_stock" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Out of Stock
        </button>
      </div>

      {/* Controls Bar: Search, Store, Sort, Column Visibility */}
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
            placeholder="Search products by name or code..."
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
              title="Filter products by store"
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stores</option>
              {stores.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {getStoreDisplayName(s, idx)} ({s.store_code})
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
              title="Sort products list"
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="created_at:desc">Newest First</option>
              <option value="title:asc">Name (A-Z)</option>
              <option value="price_cents:asc">Price: Low to High</option>
              <option value="price_cents:desc">Price: High to Low</option>
              <option value="stock_quantity:desc">Stock: High to Low</option>
              <option value="stock_quantity:asc">Stock: Low to High</option>
            </select>
          </div>

          {/* Column Visibility Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              title="Choose which columns to show"
              className="flex items-center space-x-1.5 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs apple-press"
            >
              <Columns className="h-3.5 w-3.5 text-slate-500" />
              <span>Columns</span>
            </button>

            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-apple-modal z-30 space-y-2 text-xs">
                <p className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">Show or Hide Columns</p>
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

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/90 dark:bg-orange-500/10 p-3 shadow-apple">
          <span className="text-xs font-bold text-orange-900 dark:text-orange-300">
            {selectedIds.length} product(s) selected
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setBulkAction("price")}
              title="Change price for all selected products"
              className="rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50 transition-all apple-press shadow-2xs"
            >
              Change Price
            </button>

            <button
              onClick={() => setBulkAction("stock")}
              title="Update stock count for all selected products"
              className="rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-50 transition-all apple-press shadow-2xs"
            >
              Update Stock
            </button>

            <button
              onClick={() => handleExecuteBulkAction("activate")}
              title="Mark selected products as active"
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all apple-press shadow-2xs"
            >
              Turn On
            </button>

            <button
              onClick={() => handleExecuteBulkAction("deactivate")}
              title="Turn off selected products"
              className="rounded-xl bg-slate-950 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-all apple-press shadow-2xs"
            >
              Turn Off
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-apple overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading products...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-950/80 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={products.length > 0 && selectedIds.length === products.length}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  {columnVisibility.title && <th className="px-4 py-3">Product Name</th>}
                  {columnVisibility.sellerSku && <th className="px-4 py-3">Product Code</th>}
                  {columnVisibility.darazSku && <th className="px-4 py-3">Store Variant ID</th>}
                  {columnVisibility.itemId && <th className="px-4 py-3">Store Product ID</th>}
                  {columnVisibility.price && <th className="px-4 py-3">Price</th>}
                  {columnVisibility.stock && <th className="px-4 py-3">Stock Left</th>}
                  {columnVisibility.status && <th className="px-4 py-3">Status</th>}
                  {columnVisibility.lastUpdated && <th className="px-4 py-3">Last Updated</th>}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
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
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${isSelected ? "bg-orange-50/30 dark:bg-orange-500/10" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(item.id)}
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                      </td>

                      {columnVisibility.title && (
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            {columnVisibility.image && (
                              <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                                <ProductImage
                                  src={Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</p>
                              <p className="text-[11px] text-slate-500">
                                Store: {getStoreDisplayName(item.daraz_stores)}
                              </p>
                            </div>
                          </div>
                        </td>
                      )}

                      {columnVisibility.sellerSku && (
                        <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200 font-bold">{item.seller_sku}</td>
                      )}

                      {columnVisibility.darazSku && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{item.daraz_sku_id || "N/A"}</td>
                      )}

                      {columnVisibility.itemId && (
                        <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{item.daraz_item_id || "N/A"}</td>
                      )}

                      {columnVisibility.price && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{priceFormatted}</p>
                          {columnVisibility.specialPrice && specialPriceFormatted && (
                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Sale: {specialPriceFormatted}</p>
                          )}
                        </td>
                      )}

                      {columnVisibility.stock && (
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-xl font-bold text-[11px] ${
                              item.stock_quantity > 10
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20"
                                : item.stock_quantity > 0
                                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20"
                                : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-500/20"
                            }`}
                          >
                            {item.stock_quantity} left
                          </span>
                        </td>
                      )}

                      {columnVisibility.status && (
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center space-x-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
                            <CheckCircle2 className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span>Active</span>
                          </span>
                        </td>
                      )}

                      {columnVisibility.lastUpdated && (
                        <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">
                          {item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : "Recently"}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedProductDetail(item)}
                          title="View full details of this product"
                          className="inline-flex items-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all apple-press shadow-2xs"
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
            <p className="font-medium text-slate-700 dark:text-slate-300">No products yet.</p>
            <p>Add your first product or click "Update Data" above to get started.</p>
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
              Showing {products.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalProducts)} of {totalProducts} products
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              title="Previous page"
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
              title="Next page"
              className="flex items-center space-x-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all apple-press shadow-2xs"
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
          onProductUpdated={() => fetchProducts()}
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
