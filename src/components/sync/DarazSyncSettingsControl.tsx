"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  RefreshCw,
  Store,
  ShoppingCart,
  Package,
  Layers,
  Image as ImageIcon,
  Truck,
  MapPin,
  Phone,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Check,
  Shield,
  Zap,
  Play
} from "lucide-react";
import { DarazStoreSyncSettings } from "@/lib/daraz/sync-settings-service";

interface StoreItem {
  id: string;
  store_name: string;
  store_code: string;
  seller_id: string;
  is_active: boolean;
  access_token?: string;
}

export function DarazSyncSettingsControl() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("global_default");
  const [settings, setSettings] = useState<DarazStoreSyncSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingModule, setSyncingModule] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch authorized active stores
  const fetchStores = async () => {
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      if (data.success && data.stores) {
        const activeStores = data.stores.filter((s: any) => s.is_active && s.access_token);
        setStores(activeStores);
      }
    } catch (err: any) {
      console.error("[Fetch Stores Error]:", err);
    }
  };

  // Fetch sync settings for selected store or global default
  const fetchSettings = async (storeId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const endpoint = storeId === "global_default"
        ? "/api/daraz/sync-settings/global"
        : `/api/daraz/stores/${storeId}/sync-settings`;

      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      } else {
        setErrorMessage(data.error || "Failed to load sync settings.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect sync settings service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      fetchSettings(selectedStoreId);
    }
  }, [selectedStoreId]);

  const handleToggleSetting = (key: keyof Omit<DarazStoreSyncSettings, "id" | "store_id" | "updated_at">) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleSaveSettings = async () => {
    if (!selectedStoreId || !settings) return;
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const endpoint = selectedStoreId === "global_default"
        ? "/api/daraz/sync-settings/global"
        : `/api/daraz/stores/${selectedStoreId}/sync-settings`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        throw new Error(data.error || "Failed to save sync settings.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerModuleSync = async (moduleName: string) => {
    if (selectedStoreId === "global_default") {
      setErrorMessage("Please select a specific connected store from the dropdown to run manual module sync.");
      return;
    }

    setSyncingModule(moduleName);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/daraz/stores/${selectedStoreId}/sync/module`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: moduleName }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Module sync for '${moduleName}' failed.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to run module ${moduleName}.`);
    } finally {
      setSyncingModule(null);
    }
  };

  return (
    <div className="space-y-6 text-xs select-none">
      {/* Store Selector Header Bar */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Daraz Sync Settings</h2>
            <p className="text-[11px] text-slate-500">Configure staged & incremental data synchronization modules per store account.</p>
          </div>
        </div>

        {/* Store Dropdown Selector */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <label className="font-bold text-slate-700 dark:text-slate-300 shrink-0">Target Store:</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="global_default">⚙️ Global Default Settings (New Stores)</option>
            {stores.map((st) => (
              <option key={st.id} value={st.id}>
                🏪 {st.store_name} ({st.store_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 space-y-2">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
          <p className="font-semibold">Loading sync settings for target store...</p>
        </div>
      ) : settings ? (
        <div className="space-y-6">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Core Data Modules (ON by Default) */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <span>Core Operational Data Modules</span>
                </h3>
                <p className="text-[10px] text-slate-500">Essential fast ERP sync data enabled by default for accurate operational metrics.</p>
              </div>
              <span className="rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 text-[10px] font-bold px-2.5 py-1">
                High Priority
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Orders */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Orders</h4>
                    <p className="text-[10px] text-slate-500">Sync Daraz sales orders and customer purchase status</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("orders")}
                    disabled={Boolean(syncingModule)}
                    title="Sync orders only"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "orders" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.orders_enabled}
                      onChange={() => handleToggleSetting("orders_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Order Line Items</h4>
                    <p className="text-[10px] text-slate-500">Required for Picking, Packing, and Barcode Product Scanning</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("order_items")}
                    disabled={Boolean(syncingModule)}
                    title="Sync order items only"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "order_items" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.order_items_enabled}
                      onChange={() => handleToggleSetting("order_items_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Products */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Product Catalog & SKUs</h4>
                    <p className="text-[10px] text-slate-500">Sync Daraz items, titles, Seller SKUs, and pricing</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("products")}
                    disabled={Boolean(syncingModule)}
                    title="Sync products only"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "products" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.products_enabled}
                      onChange={() => handleToggleSetting("products_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Inventory Stock */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Inventory / Stock</h4>
                    <p className="text-[10px] text-slate-500">Sync live physical stock quantities and reserved units</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("inventory")}
                    disabled={Boolean(syncingModule)}
                    title="Sync inventory stock only"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "inventory" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.inventory_enabled}
                      onChange={() => handleToggleSetting("inventory_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Active Seller Center Items */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Active Seller Center Items</h4>
                    <p className="text-[10px] text-slate-500">Export & reconcile live active listings published on Daraz</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("active_items")}
                    disabled={Boolean(syncingModule)}
                    title="Export active items only"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "active_items" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.active_items_enabled}
                      onChange={() => handleToggleSetting("active_items_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Optional Heavy Data Modules (OFF by Default) */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-purple-500" />
                  <span>Optional Heavy / Advanced Data Modules</span>
                </h3>
                <p className="text-[10px] text-slate-500">Optional modules. Enable only when required to reduce Daraz API rate limits & bandwidth.</p>
              </div>
              <span className="rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 text-[10px] font-bold px-2.5 py-1">
                Optional
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Images */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Product Images</h4>
                    <p className="text-[10px] text-slate-500">Fetch product image URLs and thumbnail media references</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("product_images")}
                    disabled={Boolean(syncingModule)}
                    title="Sync product images"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "product_images" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.product_images_enabled}
                      onChange={() => handleToggleSetting("product_images_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Shipping Labels */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Shipping Labels & PDFs</h4>
                    <p className="text-[10px] text-slate-500">Fetch package tracking & printable airway bill documents</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("shipping_labels")}
                    disabled={Boolean(syncingModule)}
                    title="Sync shipping labels"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "shipping_labels" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.shipping_labels_enabled}
                      onChange={() => handleToggleSetting("shipping_labels_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Customer Address */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-600 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Customer Shipping Address</h4>
                    <p className="text-[10px] text-slate-500">Sync full customer street address & delivery location</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.addresses_enabled}
                      onChange={() => handleToggleSetting("addresses_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Customer Phone */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Customer Phone Number</h4>
                    <p className="text-[10px] text-slate-500">Sync recipient phone contacts where provided by Daraz API</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.phone_numbers_enabled}
                      onChange={() => handleToggleSetting("phone_numbers_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>

              {/* Historical Orders */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 flex items-center justify-center shrink-0">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Historical Orders Import</h4>
                    <p className="text-[10px] text-slate-500">Fetch older historical order archives separately without blocking current orders</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerModuleSync("historical_orders")}
                    disabled={Boolean(syncingModule)}
                    title="Import historical orders"
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50"
                  >
                    {syncingModule === "historical_orders" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.historical_orders_enabled}
                      onChange={() => handleToggleSetting("historical_orders_enabled")}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-orange-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Save Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {saveSuccess && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center space-x-1">
                  <Check className="h-4 w-4" />
                  <span>Sync settings saved successfully!</span>
                </span>
              )}
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-md flex items-center space-x-2 apple-press disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Daraz Sync Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-slate-500 font-semibold bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <span>Configure sync settings above.</span>
        </div>
      )}
    </div>
  );
}
