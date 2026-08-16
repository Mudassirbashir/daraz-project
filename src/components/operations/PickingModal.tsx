"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle, PackageCheck, Scan, RefreshCw } from "lucide-react";

interface OrderItem {
  id: string;
  order_item_id: string;
  name: string;
  seller_sku: string;
  quantity: number;
  picked_quantity: number;
  is_picked: boolean;
  product_main_image?: string | null;
  item_price_cents: number;
}

interface PickingModalProps {
  order: any;
  onClose: () => void;
  onPickingCompleted?: (updatedOrder: any) => void;
}

export function PickingModal({ order, onClose, onPickingCompleted }: PickingModalProps) {
  const initialItems: OrderItem[] = (order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0)
    ? order.order_items
    : [];

  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scanSkuInput, setScanSkuInput] = useState("");

  const handleIncrementPicked = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId || item.order_item_id === itemId) {
          const nextQty = Math.min(item.quantity, item.picked_quantity + 1);
          return { ...item, picked_quantity: nextQty, is_picked: nextQty >= item.quantity };
        }
        return item;
      })
    );
  };

  const handleDecrementPicked = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId || item.order_item_id === itemId) {
          const nextQty = Math.max(0, item.picked_quantity - 1);
          return { ...item, picked_quantity: nextQty, is_picked: nextQty >= item.quantity };
        }
        return item;
      })
    );
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanSkuInput.trim()) return;

    const matched = items.find(
      (item) => item.seller_sku.toLowerCase() === scanSkuInput.trim().toLowerCase()
    );

    if (matched) {
      handleIncrementPicked(matched.id);
      setScanSkuInput("");
    } else {
      setErrorMessage(`SKU '${scanSkuInput.trim()}' not found in order items.`);
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleSubmitPicking = async (markAll: boolean = false) => {
    if (items.length === 0) {
      setErrorMessage("Cannot complete picking because this order has no items.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const payload = markAll
        ? { markAllPicked: true }
        : {
            items: items.map((i) => ({
              order_item_id: i.order_item_id,
              picked_quantity: i.picked_quantity,
            })),
          };

      const res = await fetch(`/api/orders/${order.id}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update item pick status.");
      }

      if (onPickingCompleted) {
        onPickingCompleted(data.order || order);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const allItemsPicked = items.length > 0 && items.every((item) => item.picked_quantity >= item.quantity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Warehouse Picking Station
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Order #{order.daraz_order_id} &bull; Customer: {order.customer_name || "N/A"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scan Barcode Field */}
        <form onSubmit={handleScanSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Scan SKU barcode or type SKU..."
              value={scanSkuInput}
              onChange={(e) => setScanSkuInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pl-9 pr-4 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2.5 font-bold hover:opacity-90"
          >
            Verify SKU
          </button>
        </form>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Item List */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-700 dark:text-slate-300">Items to Pick</h3>
          {items.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                No items associated with this order.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isDone = item.picked_quantity >= item.quantity;
              return (
                <div
                  key={item.id || item.order_item_id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isDone
                      ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      {item.product_main_image ? (
                        <img
                          src={item.product_main_image}
                          alt={item.name}
                          className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">
                          SKU
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="font-mono text-slate-500 text-[11px]">SKU: {item.seller_sku}</p>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => handleDecrementPicked(item.id)}
                          className="px-3 py-1.5 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          -
                        </button>
                        <span className="px-3 py-1.5 font-bold text-slate-900 dark:text-white font-mono">
                          {item.picked_quantity} of {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementPicked(item.id)}
                          className="px-3 py-1.5 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          +
                        </button>
                      </div>

                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => handleSubmitPicking(true)}
            disabled={loading || items.length === 0}
            className="px-4 py-2 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark All as Picked
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSubmitPicking(false)}
              disabled={loading || !allItemsPicked || items.length === 0}
              className={`inline-flex items-center space-x-2 rounded-xl px-5 py-2.5 font-bold text-white shadow-md transition-all ${
                allItemsPicked && items.length > 0
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-slate-400 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="h-4 w-4" />
              )}
              <span>{allItemsPicked && items.length > 0 ? "Complete Picking" : `${items.filter(i=>i.picked_quantity>=i.quantity).length}/${items.length} Picked`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
