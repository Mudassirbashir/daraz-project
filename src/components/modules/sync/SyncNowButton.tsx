"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncNowButtonProps {
  onSyncComplete?: () => void;
}

export function SyncNowButton({ onSyncComplete }: SyncNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [syncData, setSyncData] = useState<{
    success: boolean;
    message?: string;
    productsSynced?: number;
    ordersSynced?: number;
    storesSynced?: number;
    durationFormatted?: string;
    errors?: string[];
  } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setSyncData(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (res.ok) {
        setSyncData({
          success: data.success,
          message: data.message,
          productsSynced: data.productsSynced || 0,
          ordersSynced: data.ordersSynced || 0,
          storesSynced: data.storesSynced || 0,
          durationFormatted: data.durationFormatted || "0s",
          errors: data.errors || [],
        });
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncData({
          success: false,
          message: data.error || data.message || "Failed to synchronize with Daraz API.",
          errors: data.errors || [data.error || "Sync Request Failed"],
        });
      }
    } catch (err: any) {
      setSyncData({
        success: false,
        message: `Network Error: ${err.message || String(err)}`,
        errors: [err.message || String(err)],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-3">
        <Button
          onClick={handleSync}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow px-5 py-2.5 flex items-center space-x-2 transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "Synchronizing Live Daraz Data..." : "Sync Now"}</span>
        </Button>
      </div>

      {syncData && (
        <div
          className={`flex flex-col p-4 rounded-xl text-xs font-medium border space-y-2 transition-all ${
            syncData.success
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {syncData.success ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <span className="font-semibold text-sm">
                {syncData.success ? "Synchronization Completed" : "Sync Attention Required"}
              </span>
            </div>

            {syncData.durationFormatted && (
              <div className="flex items-center space-x-1 text-slate-500 bg-white/70 px-2 py-1 rounded-md border border-slate-200">
                <Clock className="h-3 w-3" />
                <span>Duration: {syncData.durationFormatted}</span>
              </div>
            )}
          </div>

          <p className="text-slate-700">{syncData.message}</p>

          {syncData.success && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-center">
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="block text-slate-500 text-[10px] uppercase font-bold">Stores Synced</span>
                <span className="text-base font-extrabold text-emerald-700">{syncData.storesSynced}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="block text-slate-500 text-[10px] uppercase font-bold">Products Synced</span>
                <span className="text-base font-extrabold text-emerald-700">{syncData.productsSynced}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="block text-slate-500 text-[10px] uppercase font-bold">Orders Synced</span>
                <span className="text-base font-extrabold text-emerald-700">{syncData.ordersSynced}</span>
              </div>
            </div>
          )}

          {syncData.errors && syncData.errors.length > 0 && (
            <div className="pt-2 border-t border-red-200/60">
              <span className="font-bold text-red-700 block mb-1">Errors / Diagnostic Output:</span>
              <ul className="list-disc list-inside space-y-1 text-red-600">
                {syncData.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
