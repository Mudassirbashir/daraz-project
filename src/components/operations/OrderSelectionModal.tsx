"use client";

import React from "react";
import { X, Layers, Store, Package, ArrowRight } from "lucide-react";
import { ScanMatchItem } from "@/lib/inventory/product-scanner-service";

interface OrderSelectionModalProps {
  isOpen: boolean;
  rawInput: string;
  matches: ScanMatchItem[];
  onClose: () => void;
  onSelectMatch: (match: ScanMatchItem) => void;
}

export function OrderSelectionModal({
  isOpen,
  rawInput,
  matches,
  onClose,
  onSelectMatch,
}: OrderSelectionModalProps) {
  if (!isOpen || matches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto text-xs">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Multiple Matches Discovered
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan input <span className="font-mono font-bold text-slate-900 dark:text-white">"{rawInput}"</span> matched {matches.length} candidates. Please select one:
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Candidate List */}
        <div className="space-y-3">
          {matches.map((item, idx) => {
            const darazOrdId = item.darazOrderId || item.daraz_order_id || item.orderId || item.order_id || "N/A";
            const storeName = item.store?.name || "Store";
            const pName = item.productName || item.product_name || item.sellerSku || item.seller_sku || "Item";
            const sSku = item.sellerSku || item.seller_sku || item.sku || "N/A";

            return (
              <div
                key={idx}
                onClick={() => onSelectMatch(item)}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="rounded-lg bg-blue-100 dark:bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                      {item.matchType || "match"}
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                      Order #{darazOrdId}
                    </span>
                  </div>

                  <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500 font-medium">
                    <Store className="h-3.5 w-3.5" />
                    <span>{storeName}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{pName}</p>
                      <p className="font-mono text-[11px] text-slate-500">SKU: {sSku}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMatch(item);
                    }}
                    className="inline-flex items-center space-x-1 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white px-3 py-1.5 font-bold shadow-sm transition-all"
                  >
                    <span>Select</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-800 px-4 py-2 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel Selection
          </button>
        </div>
      </div>
    </div>
  );
}
