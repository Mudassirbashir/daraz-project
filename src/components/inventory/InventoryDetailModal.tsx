"use client";

import React, { useState } from "react";
import {
  X,
  Package,
  Layers,
  MapPin,
  Tag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Building2,
  DollarSign
} from "lucide-react";

interface InventoryDetailModalProps {
  item: any | null;
  onClose: () => void;
}

export function InventoryDetailModal({ item, onClose }: InventoryDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!item) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const listing = item.listings?.[0] || {};
  const store = listing.daraz_stores || {};

  const available = item.quantity_on_hand || 0;
  const reserved = item.quantity_reserved || 0;
  const sellable = Math.max(0, available - reserved);
  const unitCostFormatted = (item.unit_cost_cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });
  const totalValuationFormatted = ((item.unit_cost_cents * available) / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">
                {store.store_name || "Daraz Store"}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">SKU: {item.sku}</span>
              <button
                onClick={() => copyToClipboard(item.sku, "sku")}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Copy SKU"
              >
                {copiedField === "sku" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{item.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stock Breakdown Cards Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <span className="text-[11px] font-bold uppercase text-emerald-700">Available Stock</span>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{available} Units</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center">
            <span className="text-[11px] font-bold uppercase text-amber-700">Reserved Stock</span>
            <p className="mt-1 text-2xl font-bold text-amber-900">{reserved} Units</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center">
            <span className="text-[11px] font-bold uppercase text-blue-700">Sellable Net</span>
            <p className="mt-1 text-2xl font-bold text-blue-900">{sellable} Units</p>
          </div>
        </div>

        {/* Detailed Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Warehouse & Storage Location */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span>Warehouse & Location</span>
            </h3>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Warehouse:</span>
                <span className="font-bold text-slate-800">Main Warehouse (FBD)</span>
              </div>

              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Storage Bay:</span>
                <span className="font-mono font-bold text-slate-800">{item.storage_location || "Shelf A-1"}</span>
              </div>

              <div className="flex justify-between pt-0.5">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-slate-700">{item.category || "General"}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Threshold Rules */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
              <Tag className="h-4 w-4 text-orange-500" />
              <span>Costing & Threshold Rules</span>
            </h3>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Unit Cost:</span>
                <span className="font-bold text-slate-800">{unitCostFormatted}</span>
              </div>

              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Total Stock Valuation:</span>
                <span className="font-bold text-emerald-700">{totalValuationFormatted}</span>
              </div>

              <div className="flex justify-between pt-0.5">
                <span className="text-slate-500">Low Stock Alert Threshold:</span>
                <span className="font-bold text-slate-800">{item.reorder_point || 10} Units</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status Footer Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-bold text-slate-800">Synchronized with Daraz Open Platform</span>
          </div>

          <span className="text-slate-500">
            Last Updated: {new Date(item.updated_at).toLocaleString()}
          </span>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
