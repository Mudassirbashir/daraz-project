"use client";

import React, { useState, useEffect } from "react";
import { SyncNowButton } from "@/components/common/SyncNowButton";
import { ShoppingCart, Search, Filter, RefreshCw, AlertCircle, Clock, Truck, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState("all");
  const [stores, setStores] = useState<any[]>([]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: storesData } = await (supabase as any)
        .from("daraz_stores")
        .select("id, store_code, store_name");
      setStores(storesData || []);

      let query = (supabase as any)
        .from("orders")
        .select("*, daraz_stores(store_name, store_code)")
        .order("order_date", { ascending: false });

      if (selectedStoreFilter !== "all") {
        query = query.eq("store_id", selectedStoreFilter);
      }

      const { data, error } = await query;
      if (error) console.error("[OrdersPage Error]:", error.message);
      setOrders(data || []);
    } catch (err: any) {
      console.error("[OrdersPage Exception]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedStoreFilter]);

  const filteredOrders = orders.filter((ord) => {
    // 1. Search Query Filter
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (ord.daraz_order_id && ord.daraz_order_id.toLowerCase().includes(query)) ||
      (ord.customer_name && ord.customer_name.toLowerCase().includes(query)) ||
      (ord.tracking_number && ord.tracking_number.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    // 2. Status Tab Filter
    const status = (ord.status || "").toLowerCase();
    if (activeTab === "all") return true;
    if (activeTab === "pending") return ["pending", "unpaid"].includes(status);
    if (activeTab === "ready_to_ship") return status === "ready_to_ship";
    if (activeTab === "delivered") return ["delivered", "shipped"].includes(status);
    if (activeTab === "canceled") return ["canceled", "returned", "failed"].includes(status);

    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (["pending", "unpaid"].includes(s)) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
          <Clock className="h-3 w-3 text-amber-600" />
          <span>Pending</span>
        </span>
      );
    }
    if (s === "ready_to_ship") {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
          <Truck className="h-3 w-3 text-blue-600" />
          <span>Ready to Ship</span>
        </span>
      );
    }
    if (["delivered", "shipped"].includes(s)) {
      return (
        <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>Delivered</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
        <XCircle className="h-3 w-3 text-red-600" />
        <span>Cancelled</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Sync */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Daraz Orders Management</h1>
          <p className="text-xs text-slate-500">
            Real-time customer orders, fulfillment statuses, and tracking synchronized with Daraz.
          </p>
        </div>
        <SyncNowButton />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            activeTab === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          All Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            activeTab === "pending"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Pending ({orders.filter((o) => ["pending", "unpaid"].includes(o.status)).length})
        </button>

        <button
          onClick={() => setActiveTab("ready_to_ship")}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            activeTab === "ready_to_ship"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Ready to Ship ({orders.filter((o) => o.status === "ready_to_ship").length})
        </button>

        <button
          onClick={() => setActiveTab("delivered")}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            activeTab === "delivered"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Delivered ({orders.filter((o) => ["delivered", "shipped"].includes(o.status)).length})
        </button>

        <button
          onClick={() => setActiveTab("canceled")}
          className={`px-4 py-2 font-bold rounded-lg transition-all ${
            activeTab === "canceled"
              ? "bg-red-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Cancelled ({orders.filter((o) => ["canceled", "returned", "failed"].includes(o.status)).length})
        </button>
      </div>

      {/* Controls Bar: Search & Store Filter */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders by Order ID, Customer Name, or Tracking Code..."
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

      {/* Orders Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
            <span>Loading live orders...</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Order ID & Date</th>
                  <th className="px-4 py-3">Customer & City</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Tracking Number</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => {
                  const amountFormatted = (ord.total_amount_cents / 100).toLocaleString("en-PK", {
                    style: "currency",
                    currency: "PKR",
                  });

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">#{ord.daraz_order_id}</p>
                        <p className="text-[11px] text-slate-400">
                          {new Date(ord.order_date).toLocaleString()}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{ord.customer_name || "Customer"}</p>
                        <p className="text-[11px] text-slate-400">{ord.customer_city || "Pakistan"}</p>
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {ord.daraz_stores?.store_name || "Daraz Store"}
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        {ord.tracking_number || "Pending Tracking"}
                      </td>

                      <td className="px-4 py-3 font-bold text-slate-900">{amountFormatted}</td>

                      <td className="px-4 py-3">{getStatusBadge(ord.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">No orders found matching this filter.</p>
            <p>Click "Sync Now" above to pull live orders from Daraz Open Platform.</p>
          </div>
        )}
      </div>
    </div>
  );
}
