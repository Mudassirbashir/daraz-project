"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logDashboardError } from "@/lib/logging/dashboard-logger";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logDashboardError("Dashboard Error Boundary", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Dashboard Notice</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Something went wrong while loading this page.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
            The operational dashboard encountered a service component issue. Technical details have been safely logged to server runtime diagnostics.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1">
              Error Digest Reference: <span className="font-bold">{error.digest}</span>
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-1">
          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      </div>
    </div>
  );
}
