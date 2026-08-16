"use client";

import React, { useState } from "react";
import { X, PackageCheck, CheckCircle2, Barcode, AlertCircle, RefreshCw, Printer, ArrowRight, Check } from "lucide-react";
import { getStoreDisplayName } from "@/lib/daraz/store-utils";

interface PackingModalProps {
  order: any | null;
  onClose: () => void;
  onOrderPacked?: (updatedOrder: any) => void;
  onOpenShippingLabel?: (order: any) => void;
}

export function PackingModal({
  order,
  onClose,
  onOrderPacked,
  onOpenShippingLabel,
}: PackingModalProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [barcodeInput, setBarcodeInput] = useState("");
  const [packingState, setPackingState] = useState<"idle" | "packing" | "packed" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [updatedOrder, setUpdatedOrder] = useState<any | null>(null);

  if (!order) return null;

  // Mock order items list if items not populated
  const items = order.items && order.items.length > 0
    ? order.items
    : [
        {
          id: "item-1",
          name: order.product_title || `Daraz Order Items (SKU: ${order.tracking_number || order.daraz_order_id})`,
          sku: order.tracking_number || `SKU_${order.daraz_order_id}`,
          quantity: 1,
        },
      ];

  const allItemsChecked = items.every((_: any, idx: number) => checkedItems[idx]);

  const handleToggleItem = (idx: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const handleScanBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const term = barcodeInput.trim().toLowerCase();
    const matchIdx = items.findIndex((it: any) =>
      (it.name || "").toLowerCase().includes(term) || (it.sku || "").toLowerCase().includes(term)
    );

    if (matchIdx !== -1) {
      setCheckedItems((prev) => ({ ...prev, [matchIdx]: true }));
      setBarcodeInput("");
    } else {
      alert(`Barcode SKU "${barcodeInput}" not found in this package.`);
    }
  };

  const handleMarkAsPacked = async () => {
    setPackingState("packing");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/orders/${order.id}/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to mark order as packed.");

      setPackingState("packed");
      setUpdatedOrder(data.order);
      if (onOrderPacked) onOrderPacked(data.order);
    } catch (err: any) {
      setPackingState("error");
      setErrorMessage(err.message || "Packing failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto text-xs">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="rounded-xl bg-orange-100 dark:bg-orange-500/20 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">
                {getStoreDisplayName(order.daraz_stores)}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">Order #{order.daraz_order_id}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <PackageCheck className="h-5 w-5 text-orange-500" />
              <span>PACK ORDER STATIONS</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer & Location Info Box */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 grid grid-cols-2 gap-4">
          <div>
            <span className="text-slate-500 font-medium">Customer:</span>
            <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{order.customer_name || "Customer"}</p>
            <p className="text-slate-500">{order.customer_city || "Pakistan"}</p>
          </div>

          <div className="text-right">
            <span className="text-slate-500 font-medium">Fulfillment Status:</span>
            <p className="font-bold text-orange-600 dark:text-orange-400 capitalize text-sm mt-0.5">
              {packingState === "packed" || order.is_packed ? "✓ Packed (Ready for Label)" : "Ready to Pack"}
            </p>
          </div>
        </div>

        {/* Barcode Quick Verification Scanner */}
        {packingState !== "packed" && !order.is_packed && (
          <form onSubmit={handleScanBarcode} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan item barcode to verify package contents..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 pl-10 pr-4 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-slate-950 dark:bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-800 apple-press"
            >
              Verify Scan
            </button>
          </form>
        )}

        {/* Items Packing Checklist */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Package Items Checklist ({items.length} item{items.length > 1 ? "s" : ""})
          </h3>

          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-900">
            {items.map((it: any, idx: number) => {
              const isChecked = Boolean(checkedItems[idx]) || packingState === "packed" || order.is_packed;

              return (
                <div
                  key={idx}
                  onClick={() => handleToggleItem(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                      : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`h-5 w-5 rounded-lg border flex items-center justify-center font-bold text-white transition-all ${
                        isChecked ? "bg-emerald-600 border-emerald-600" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      }`}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </div>

                    <div>
                      <p className="font-bold">{it.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">SKU: {it.sku}</p>
                    </div>
                  </div>

                  <span className="font-mono font-bold text-sm px-2 py-1 rounded-lg bg-white/80 dark:bg-slate-900 border">
                    Qty: {it.quantity || 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error message */}
        {packingState === "error" && (
          <div className="p-3 rounded-xl bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Banner */}
        {(packingState === "packed" || order.is_packed) && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 p-4 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>✓ Order Packed & Verified. Ready for Official Shipping Label.</span>
            </div>

            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Order #{order.daraz_order_id} is packed and ready. Proceed to print the official Daraz shipping label.
            </p>

            <button
              onClick={() => {
                if (onOpenShippingLabel) onOpenShippingLabel(updatedOrder || order);
                onClose();
              }}
              className="inline-flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700 shadow-md transition-all apple-press"
            >
              <Printer className="h-4 w-4" />
              <span>Print Official Shipping Label</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Footer Actions */}
        {packingState !== "packed" && !order.is_packed && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-slate-800 px-4 py-2 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
            >
              Cancel
            </button>

            <button
              onClick={handleMarkAsPacked}
              disabled={packingState === "packing"}
              className="inline-flex items-center space-x-2 rounded-xl bg-orange-600 px-5 py-2.5 font-bold text-white hover:bg-orange-700 shadow-md transition-all apple-press disabled:opacity-50"
            >
              {packingState === "packing" ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Marking as Packed...</span>
                </>
              ) : (
                <>
                  <PackageCheck className="h-4 w-4" />
                  <span>Mark as Packed</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
