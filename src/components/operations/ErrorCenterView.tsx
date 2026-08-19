"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert, XCircle, Clock } from "lucide-react";
import { getStoreDisplayName } from "@/lib/daraz/store-utils";

export function ErrorCenterView() {
  const [loading, setLoading] = useState(true);
  const [retryErrors, setRetryErrors] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/errors");
      const data = await res.json();
      if (data.success) {
        setRetryErrors(data.retryErrors || []);
        setApiLogs(data.apiLogs || []);
      }
    } catch (err: any) {
      console.error("[FetchErrors Error]:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const handleRetrySync = async () => {
    setIsRetrying(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/admin/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_sync" }),
      });
      const data = await res.json();
      setActionMessage(data.message || "Retry action submitted.");
      fetchErrors();
    } catch (err: any) {
      setActionMessage(`Retry failed: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetryItem = async (errorId: string) => {
    setIsRetrying(true);
    setActionMessage("");
    try {
      const res = await fetch("/api/admin/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errorId, action: "retry_item" }),
      });
      const data = await res.json();
      setActionMessage(data.message || "Retry execution finished.");
      fetchErrors();
    } catch (err: any) {
      setActionMessage(`Item retry failed: ${err.message}`);
    } finally {
      setIsRetrying(false);
    }
  };

  const totalErrorCount = retryErrors.length + apiLogs.length;

  return (
    <div className="space-y-6 text-xs">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            <span className="font-bold text-red-400 text-sm">System Diagnostics & Error Center</span>
          </div>
          <p className="text-slate-400 max-w-xl">
            Real-time tracking of failed Daraz API syncs, shipping label errors, and retry attempts with idempotent execution guards.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchErrors}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold inline-flex items-center space-x-2 border border-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Diagnostics</span>
          </button>

          <button
            onClick={handleRetrySync}
            disabled={isRetrying}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold inline-flex items-center space-x-2 shadow-md transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
            <span>Retry Daraz Sync Now</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-2xl bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300 font-bold border border-blue-200">
          {actionMessage}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center space-x-3">
          <XCircle className="h-8 w-8 text-red-600" />
          <div>
            <p className="text-red-600 font-bold text-lg">{totalErrorCount}</p>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Active Diagnostic Failures</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center space-x-3">
          <Clock className="h-8 w-8 text-amber-600" />
          <div>
            <p className="text-amber-600 font-bold text-lg">{retryErrors.length}</p>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Queued for Safe Retry</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center space-x-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <div>
            <p className="text-emerald-600 font-bold text-lg">{apiLogs.length}</p>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Logged API Failures</p>
          </div>
        </div>
      </div>

      {/* Diagnostic Queue Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-sm">
          Failed Sync & Operational Diagnostics Log
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-orange-500 mb-2" />
            <span>Loading diagnostic logs...</span>
          </div>
        ) : retryErrors.length === 0 && apiLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">All Operational Systems Normal</h4>
            <p className="text-slate-400">No active Daraz API or sync errors logged.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="p-3">Store</th>
                  <th className="p-3">Operation / Entity</th>
                  <th className="p-3">Error Reason</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {retryErrors.map((err) => (
                  <tr key={err.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {getStoreDisplayName(err.daraz_stores)}
                    </td>
                    <td className="p-3 font-mono">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{err.operation_type}</span>
                      <p className="text-slate-400 text-[10px]">ID: {err.entity_id}</p>
                    </td>
                    <td className="p-3 text-red-600 dark:text-red-400 max-w-xs truncate font-mono">
                      {err.error_message}
                    </td>
                    <td className="p-3 font-bold">
                      {err.attempt_count || 1}x
                      {err.status === "needs_manual_review" && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          Manual Review
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500">{new Date(err.last_attempt_at || err.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRetryItem(err.id)}
                        disabled={isRetrying || err.status === "needs_manual_review"}
                        className={`px-3 py-1.5 rounded-xl text-white font-bold inline-flex items-center space-x-1 ${
                          err.status === "needs_manual_review"
                            ? "bg-slate-400 dark:bg-slate-700 cursor-not-allowed"
                            : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
                        }`}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>{err.status === "needs_manual_review" ? "Flagged" : "Retry"}</span>
                      </button>
                    </td>
                  </tr>
                ))}

                {apiLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {getStoreDisplayName(log.daraz_stores)}
                    </td>
                    <td className="p-3 font-mono">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{log.sync_type}</span>
                      <p className="text-slate-400 text-[10px]">Status: {log.status}</p>
                    </td>
                    <td className="p-3 text-red-600 dark:text-red-400 max-w-xs truncate font-mono">
                      {log.error_message || "API call returned error response code."}
                    </td>
                    <td className="p-3 font-bold">1x</td>
                    <td className="p-3 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={handleRetrySync}
                        disabled={isRetrying}
                        className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 inline-flex items-center space-x-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Retry Sync</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
