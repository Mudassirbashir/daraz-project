'use client';

import React, { useState } from 'react';

export interface StockPushConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  storeName: string;
  skuCount: number;
}

export function StockPushConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  storeName,
  skuCount,
}: StockPushConfirmationModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl text-slate-100">
        <h3 className="text-xl font-bold text-amber-400 mb-2">⚠️ Confirm Stock Push to Daraz</h3>
        <p className="text-slate-300 text-sm mb-4">
          You are about to push updated available stock quantities for <span className="font-semibold text-white">{skuCount} SKU(s)</span> directly to Daraz Seller Center store <span className="font-semibold text-indigo-400">{storeName}</span>.
        </p>
        <p className="text-slate-400 text-xs mb-6 bg-slate-800/60 p-3 rounded border border-slate-700">
          This operation will immediately overwrite inventory levels on Daraz. Make sure physical stock ledger counts are verified before confirming.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {loading ? 'Pushing Stock...' : 'Confirm Stock Push'}
          </button>
        </div>
      </div>
    </div>
  );
}
