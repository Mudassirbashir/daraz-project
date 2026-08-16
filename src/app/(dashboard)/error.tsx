"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
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
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Dashboard Operational Notice</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Something went wrong while rendering dashboard content.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
            The operational dashboard encountered a service component issue. Technical diagnostic details have been safely recorded to server runtime logs.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700/40 mt-1">
              Vercel Error Digest: <span className="font-bold text-slate-700 dark:text-slate-300">{error.digest}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <a
            href="/dashboard"
            className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 px-3.5 py-2 rounded-xl font-bold text-xs transition-all border border-slate-200 dark:border-slate-700"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Reload Dashboard</span>
          </a>

          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md apple-press"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Operation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

