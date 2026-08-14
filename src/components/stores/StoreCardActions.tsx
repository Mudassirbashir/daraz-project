"use client";

import React, { useState } from "react";
import { ExternalLink, RefreshCw, PowerOff, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface StoreCardActionsProps {
  storeId: string;
  storeName: string;
  isConnected: boolean;
}

export function StoreCardActions({ storeId, storeName, isConnected }: StoreCardActionsProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/stores/${storeId}/disconnect`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to disconnect store.");
      }

      setShowConfirmModal(false);
      router.refresh();
    } catch (err: any) {
      console.error("[StoreCardActions Error]:", err.message);
      setErrorMessage(err.message || "Failed to disconnect store.");
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isConnected) {
    return (
      <a
        href="/api/auth/daraz/login"
        title="Connect this Daraz store account"
        className="w-full inline-flex items-center justify-center space-x-2 rounded-xl bg-orange-500 px-4 py-2.5 font-bold text-white shadow-md hover:bg-orange-600 transition-all apple-press"
      >
        <span>Connect Store</span>
      </a>
    );
  }

  return (
    <>
      <div className="flex items-center space-x-2 w-full">
        <a
          href={`/listings?store_id=${storeId}`}
          title="Open store products"
          className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all apple-press shadow-2xs text-xs"
        >
          <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
          <span>Open Store</span>
        </a>

        <a
          href="/api/auth/daraz/login"
          title="Reconnect Daraz store account"
          className="inline-flex items-center justify-center p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </a>

        <button
          onClick={() => setShowConfirmModal(true)}
          title="Disconnect this store from Daraz Hub"
          className="inline-flex items-center justify-center p-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all text-xs"
        >
          <PowerOff className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-2xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Disconnect Store?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Store: <strong className="text-slate-900 dark:text-white">{storeName}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
              This will disconnect <strong>{storeName}</strong> from Daraz Hub. Background updates will pause and API access will be revoked. Your actual Daraz Seller Center store will <strong>NOT</strong> be deleted.
            </p>

            {errorMessage && (
              <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-2.5 rounded-xl border border-red-200 dark:border-red-500/20">
                {errorMessage}
              </p>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={disconnecting}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-50 inline-flex items-center space-x-1.5"
              >
                <PowerOff className="h-3.5 w-3.5" />
                <span>{disconnecting ? "Disconnecting..." : "Disconnect Store"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
