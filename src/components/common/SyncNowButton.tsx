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
        throw new Error(data.errors?.[0] || data.message || "Synchronization failed.");
      }

      setStatusMessage({
        type: "success",
        text: `Sync complete! ${data.productsSynced || 0} Products, ${data.ordersSynced || 0} Orders updated.`,
      });
      router.refresh();
    } catch (err: any) {
      console.error("[SyncNowButton Error]:", err.message);
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to trigger Daraz API sync.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end space-y-1">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center space-x-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 transition-all disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Syncing Live Daraz Data..." : "Sync Now"}</span>
      </button>

      {statusMessage && (
        <div
          className={`flex items-center space-x-1 text-[11px] font-medium px-2 py-1 rounded-md ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-3 w-3 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
