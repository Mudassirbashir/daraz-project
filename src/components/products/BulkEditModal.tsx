"use client";

import React, { useState } from "react";
import { X, DollarSign, Package, AlertCircle } from "lucide-react";

interface BulkEditModalProps {
  action: "price" | "stock" | null;
  selectedCount: number;
  onClose: () => void;
  onConfirm: (value: string) => Promise<void>;
}

export function BulkEditModal({ action, selectedCount, onClose, onConfirm }: BulkEditModalProps) {
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!action) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim()) {
      setError("Please enter a valid value.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onConfirm(val.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {action === "price" ? "Bulk Update Price (PKR)" : "Bulk Update Stock Quantity"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          This will update the {action === "price" ? "price" : "stock quantity"} for <strong>{selectedCount}</strong> selected product(s).
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New {action === "price" ? "Price (PKR)" : "Stock Quantity"}
            </label>
            <input
              type="number"
              step={action === "price" ? "0.01" : "1"}
              min="0"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={action === "price" ? "e.g. 1499.00" : "e.g. 50"}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-orange-500 px-5 py-2 text-xs font-bold text-white hover:bg-orange-600 transition-all disabled:opacity-50"
            >
              {loading ? "Updating..." : "Apply Bulk Update"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
