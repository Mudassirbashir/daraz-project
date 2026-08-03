import React from "react";
import { SyncNowButton } from "@/components/modules/sync/SyncNowButton";
import { RefreshCw, Store, Tag, ShoppingCart, KeyRound, ShieldCheck } from "lucide-react";

export default function SyncPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daraz API Synchronization</h1>
          <p className="text-sm text-slate-500">
            Real-time synchronization for Daraz Open Platform stores, product listings, and orders.
          </p>
        </div>
      </div>

      {/* Sync Control Header Card */}
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-orange-600 font-semibold text-sm">
              <RefreshCw className="h-4 w-4" />
              <span>Daraz Open Platform Manual & Automated Sync</span>
            </div>
            <p className="text-xs text-slate-600">
              Clicking <strong>Sync Now</strong> will generate an HMAC-SHA256 authenticated request to fetch store profiles, catalog listings, and recent customer orders into Supabase.
            </p>
          </div>
          <SyncNowButton />
        </div>
      </div>

      {/* Operational Sync Metrics Shell */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Connected Stores</span>
            <Store className="h-5 w-5 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">1 Active</p>
          <span className="text-xs text-slate-500 font-medium">Daraz PK Store #1</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Synced Listings</span>
            <Tag className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">3 SKUs</p>
          <span className="text-xs text-emerald-600 font-medium">Catalog synced to Supabase</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Synced Orders</span>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">3 Orders</p>
          <span className="text-xs text-blue-600 font-medium">Auto-upserted to DB</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">HMAC Auth Security</span>
            <ShieldCheck className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">SHA256</p>
          <span className="text-xs text-purple-600 font-medium">Daraz Open Platform Standard</span>
        </div>
      </div>

      {/* API Protocol & Credentials Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <KeyRound className="h-5 w-5 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">API Credentials & Security Status</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <span className="font-semibold text-slate-700">App Key:</span>
            <p className="font-mono text-slate-500 mt-0.5">DARAZ_APP_KEY (Configured in .env)</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
            <span className="font-semibold text-slate-700">Signature Method:</span>
            <p className="font-mono text-slate-500 mt-0.5">HMAC-SHA256 (Upper-case Hex)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
