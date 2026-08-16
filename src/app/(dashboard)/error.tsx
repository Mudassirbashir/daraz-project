"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Server } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DASHBOARD FATAL ERROR - Dashboard Error Boundary]:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
    });
  }, [error]);

  const isEnvVarError = error.message?.includes("Missing Environment Variable") || error.message?.includes("environment variable");

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-6">
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Dashboard Component Exception</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Vercel Environment Variable Diagnostic</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 space-y-2">
          <div className="flex items-center space-x-2 text-red-800 dark:text-red-300 font-bold text-xs">
            <Server className="h-4 w-4 shrink-0" />
            <span>Exact Diagnostic Error:</span>
          </div>
          <p className="text-xs font-mono text-red-700 dark:text-red-200 leading-relaxed break-words">
            {error.message || "An unexpected error occurred while rendering the dashboard."}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1">
              Vercel Error Digest: {error.digest}
            </p>
          )}
        </div>

        {isEnvVarError && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-bold text-slate-900 dark:text-white">Required Fix in Vercel Dashboard:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your project on Vercel Dashboard &rarr; <strong>Settings</strong> &rarr; <strong>Environment Variables</strong></li>
              <li>Add the missing variable for <strong>Production</strong>, <strong>Preview</strong>, and <strong>Development</strong></li>
              <li>Navigate to <strong>Deployments</strong> &rarr; Click <strong>Redeploy</strong> to apply changes</li>
            </ol>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry Operation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
