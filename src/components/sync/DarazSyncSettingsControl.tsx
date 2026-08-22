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
  Play,
  Lock,
} from "lucide-react";
import { DarazStoreSyncSettings, REQUIRED_OPERATIONAL_FIELDS } from "@/lib/daraz/sync-settings-service";

interface StoreItem {
  id: string;
  store_name: string;
  store_code: string;
  seller_id: string;
  is_active: boolean;
  isConnected?: boolean;
  authorization_status?: string;
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
        const activeStores = data.stores.filter((s: any) => s.is_active && (s.isConnected !== false));
        setStores(activeStores);
      }
    } catch (err: any) {
      console.error("[Fetch Stores Error]:", err);
    }
  };

  // Fetch sync settings for selected store or global default
  const fetchSettings = async (storeId: string) => {
    const cacheKey = `daraz_sync_settings_${storeId}`;
    let hasCache = false;

    if (typeof window !== "undefined") {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        try {
          const cachedSettings = JSON.parse(cachedStr);
          setSettings(cachedSettings);
          setLoading(false);
          hasCache = true;
        } catch (_) {}
      }
    }

    if (!hasCache) setLoading(true);
    setErrorMessage(null);

    try {
      const endpoint = storeId === "global_default"
        ? "/api/daraz/sync-settings/global"
        : `/api/daraz/stores/${storeId}/sync-settings`;

      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(data.settings));
        }
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

  const handleToggleSetting = async (key: keyof Omit<DarazStoreSyncSettings, "id" | "store_id" | "updated_at">) => {
    if (!settings || !selectedStoreId) return;

    // Do not allow toggling operational required scanner fields off
    if (REQUIRED_OPERATIONAL_FIELDS.includes(key)) {
      setErrorMessage("This module is required for warehouse Picking, Packing, and Barcode/Order Scanning functionality and cannot be disabled.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const newValue = !settings[key];
    const updatedSettings = {
      ...settings,
      [key]: newValue,
    };

    // 1. Instant UI update
    setSettings(updatedSettings);

    // 2. Instant localStorage cache update
    const cacheKey = `daraz_sync_settings_${selectedStoreId}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(cacheKey, JSON.stringify(updatedSettings));
    }

    // 3. Instant Database Auto-Save
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
        body: JSON.stringify(updatedSettings),
      });

      const data = await res.json();

      if (data.success && data.settings) {
        setSettings(data.settings);
        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(data.settings));
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        throw new Error(data.error || "Failed to auto-save sync settings.");
      }
    } catch (err: any) {
      console.error("[Auto-Save Sync Settings Error]:", err.message);
      setErrorMessage(`Auto-save notice: ${err.message}`);
    } finally {
      setSaving(false);
    }

    // 4. Trigger instant background sync when turning a module ON for a connected store
    if (newValue && selectedStoreId !== "global_default") {
      const moduleNameMap: Record<string, string> = {
        orders_enabled: "orders",
        order_items_enabled: "order_items",
        products_enabled: "products",
        product_skus_enabled: "skus",
        inventory_enabled: "inventory",
        active_items_enabled: "active_items",
        product_images_enabled: "product_images",
        shipping_labels_enabled: "shipping_labels",
        historical_orders_enabled: "historical_orders",
      };

      const targetModule = moduleNameMap[String(key)];
      if (targetModule) {
        handleTriggerModuleSync(targetModule);
      }
    }
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
        const cacheKey = `daraz_sync_settings_${selectedStoreId}`;
        if (typeof window !== "undefined") {
          localStorage.setItem(cacheKey, JSON.stringify(data.settings));
        }
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
            <p className="text-[11px] text-slate-500">Configure core operational data and optional heavy sync modules per store account.</p>
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

          {/* Section 1: Core Operational Data (ON by Default) */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <span>CORE OPERATIONAL DATA</span>
                </h3>
                <p className="text-[11px] text-slate-500">Essential fast sync modules enabled by default. Barcode, SKU, Seller SKU, Order ID, and Order Item ID are required for warehouse scanner functionality.</p>
              </div>
              <span className="rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 text-[10px] font-bold px-2.5 py-1">
                Enabled by Default
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Orders */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 dark:text-white">Orders & Tracking Numbers</h4>
                        <span className="rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40 text-[9px] font-bold px-2 py-0.5 flex items-center space-x-1 shrink-0">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Required for Operations</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs Daraz sales orders, order IDs, statuses, and courier tracking numbers.</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        Order ID & Tracking Number are required for Picking, Packing, and Order Scanning.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("orders")}
                    disabled={Boolean(syncingModule)}
                    title="Sync orders only"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "orders" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Orders</span>
                  </button>
                  <label className="relative inline-flex items-center cursor-not-allowed opacity-80" title="Required for operations and warehouse scanner functionality. Cannot be disabled.">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-orange-500 peer-focus:outline-none rounded-full peer dark:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[18px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              </div>

              {/* Order Line Items */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 dark:text-white">Order Line Items</h4>
                        <span className="rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40 text-[9px] font-bold px-2 py-0.5 flex items-center space-x-1 shrink-0">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Required for Operations</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs individual order items, quantities, prices, and item fulfillment status.</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        Order Item ID is required for Picking and Packing scanner validation.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("order_items")}
                    disabled={Boolean(syncingModule)}
                    title="Sync order items only"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "order_items" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Line Items</span>
                  </button>
                  <label className="relative inline-flex items-center cursor-not-allowed opacity-80" title="Required for operations and warehouse scanner functionality. Cannot be disabled.">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-orange-500 peer-focus:outline-none rounded-full peer dark:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[18px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              </div>

              {/* Products, SKUs & Barcodes */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 dark:text-white">Products, SKUs & Barcodes</h4>
                        <span className="rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300/40 text-[9px] font-bold px-2 py-0.5 flex items-center space-x-1 shrink-0">
                          <Lock className="h-2.5 w-2.5" />
                          <span>Required for Operations</span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs catalog items, titles, SKUs, Seller SKUs, and Barcode identifiers.</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                        Barcode, SKU, and Seller SKU are required for warehouse scanner product lookup.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("products")}
                    disabled={Boolean(syncingModule)}
                    title="Sync products only"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "products" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Products & SKUs</span>
                  </button>
                  <label className="relative inline-flex items-center cursor-not-allowed opacity-80" title="Required for operations and warehouse scanner functionality. Cannot be disabled.">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-orange-500 peer-focus:outline-none rounded-full peer dark:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[18px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                  </label>
                </div>
              </div>

              {/* Inventory Stock */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Inventory / Stock</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs physical stock quantities, reserved units, and warehouse location inventory.</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Tracks live stock levels across warehouse inventory locations.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("inventory")}
                    disabled={Boolean(syncingModule)}
                    title="Sync inventory stock only"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "inventory" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Stock</span>
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
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Active Seller Center Items</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Exports and reconciles live active listings published on Daraz Seller Center.</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        Reconciles active listings state against Daraz seller platform.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("active_items")}
                    disabled={Boolean(syncingModule)}
                    title="Export active items only"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "active_items" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Active Items</span>
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
                  <span>OPTIONAL HEAVY DATA</span>
                </h3>
                <p className="text-[11px] text-slate-500">High-bandwidth optional data modules. Disabled by default to minimize Daraz API rate limit usage and maximize sync performance.</p>
              </div>
              <span className="rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 text-[10px] font-bold px-2.5 py-1">
                Disabled by Default
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Images */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Product Images</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Fetches product images and thumbnail image media references from Daraz CDN.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("product_images")}
                    disabled={Boolean(syncingModule)}
                    title="Sync product images"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "product_images" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Images</span>
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
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Shipping Labels & PDFs</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Fetches printable shipping label PDF documents and package airway bills.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("shipping_labels")}
                    disabled={Boolean(syncingModule)}
                    title="Sync shipping labels"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "shipping_labels" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Sync Airway Bills</span>
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
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Customer Shipping Address</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs full customer street address, city, and delivery location details.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
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
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Customer Phone Number</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Syncs recipient contact phone numbers when authorized by Daraz API.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
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
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-500/20 text-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                      <History className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">Historical Orders Import</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Imports older historical order archives separately without delaying active orders.</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <button
                    onClick={() => handleTriggerModuleSync("historical_orders")}
                    disabled={Boolean(syncingModule)}
                    title="Import historical orders"
                    className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold transition-all disabled:opacity-50 flex items-center space-x-1 text-[10px]"
                  >
                    {syncingModule === "historical_orders" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    <span>Import History</span>
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
      ) : null}
    </div>
  );
}


