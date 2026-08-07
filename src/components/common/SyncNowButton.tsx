"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncNowButton() {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.errors?.[0] || data.message || "We couldn't update your data right now.");
      }

      setStatusMessage({
        type: "success",
        text: `Done! Updated ${data.productsSynced || 0} products and ${data.ordersSynced || 0} orders.`,
      });
      router.refresh();
    } catch (err: any) {
      console.error("[SyncNowButton Error]:", err.message);
      setStatusMessage({
        type: "error",
        text: "We couldn't update your data. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end space-y-1.5 select-none">
      <button
        onClick={handleSync}
        disabled={loading}
        title="Fetch latest products and orders from your Daraz stores"
        className="inline-flex items-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:brightness-105 active:scale-95 transition-all apple-press border border-white/20 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Updating Data..." : "Update Data"}</span>
      </button>

      {statusMessage && (
        <div
          className={`flex items-center space-x-1.5 text-[11px] font-bold px-3 py-1 rounded-xl shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-50/90 text-emerald-800 border border-emerald-200/80"
              : "bg-red-50/90 text-red-800 border border-red-200/80"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
