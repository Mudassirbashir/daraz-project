"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { Package, Search, Tag, DollarSign, Filter, RefreshCw, Image as ImageIcon, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("all");
  const [stores, setStores] = useState<any[]>([]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: storesData } = await (supabase as any)
        .from("daraz_stores")
        .select("id, store_code, store_name");
      setStores(storesData || []);

      let query = (supabase as any)
        .from("listings")
        .select("*, daraz_stores(store_name, store_code)")
        .order("created_at", { ascending: false });

      if (selectedStoreFilter !== "all") {
        query = query.eq("store_id", selectedStoreFilter);
      }

      const { data, error } = await query;
      if (error) console.error("[ListingsPage Error]:", error.message);
      setListings(data || []);
    } catch (err: any) {
      console.error("[ListingsPage Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [selectedStoreFilter]);

  const filteredListings = listings.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(query)) ||
      (item.seller_sku && item.seller_sku.toLowerCase().includes(query)) ||
      (item.daraz_item_id && item.daraz_item_id.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Title & Sync Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Daraz Product Catalog</h1>
          <p className="text-xs text-slate-500">
            Imported SKUs, pricing, stock levels, and store listings synchronized with Daraz Open Platform.
          </p>
        </div>
        <SyncNowButton />
      </div>

      {/* Metrics Shell */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total Synced Products</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{listings.length} SKUs</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Active Inventory SKUs</span>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {listings.filter((l) => l.stock_quantity > 0).length} In Stock
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase">Out of Stock SKUs</span>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {listings.filter((l) => l.stock_quantity === 0).length} Out of Stock
          </p>
        </div>
      </div>

      {/* Controls Bar: Search & Store Filter */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by SKU, Title, or Product ID..."
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.store_name} ({s.store_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading live product listings...</span>
          </div>
        ) : filteredListings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name & SKU</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Daraz Product ID</th>
                  <th className="px-4 py-3">Price (PKR)</th>
                  <th className="px-4 py-3">Stock Quantity</th>
                  <th className="px-4 py-3">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredListings.map((item) => {
                  const priceFormatted = (item.price_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 line-clamp-1">{item.title}</p>
                            <p className="font-mono text-[11px] text-slate-500">Seller SKU: {item.seller_sku}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {item.daraz_stores?.store_name || "Daraz Store"}
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        {item.daraz_item_id || item.daraz_sku_id || "N/A"}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">{priceFormatted}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            item.stock_quantity > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {item.stock_quantity} Units
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center space-x-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                          <span>Synced Live</span>
                        </span>
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
            <p className="font-medium text-slate-700">No products found matching your search.</p>
            <p>Click "Sync Now" above to fetch live catalog items from Daraz Open Platform.</p>
          </div>
        )}
      </div>
    </div>
  );
}
