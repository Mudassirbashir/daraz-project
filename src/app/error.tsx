"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Server } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Vercel Production Runtime Exception]:", error);
  }, [error]);

  const isEnvVarError = error.message?.includes("Missing Environment Variable") || error.message?.includes("environment variable");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3 text-red-400">
          <div className="p-3 bg-red-500/10 rounded-2xl">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Application Environment Error</h1>
            <p className="text-xs text-slate-400">Vercel Production Configuration Diagnostic</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/50 space-y-2">
          <div className="flex items-center space-x-2 text-red-300 font-bold text-xs">
            <Server className="h-4 w-4 shrink-0" />
            <span>Exact Error Details:</span>
          </div>
          <p className="text-xs font-mono text-red-200 leading-relaxed break-words">
            {error.message || "An unhandled server-side exception occurred."}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-500 pt-1">
              Vercel Error Digest: {error.digest}
            </p>
          )}
        </div>

        {isEnvVarError && (
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-2 text-xs text-slate-300">
            <p className="font-bold text-white">How to fix this in Vercel:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Go to your Vercel Dashboard &rarr; Project Settings &rarr; <strong>Environment Variables</strong></li>
              <li>Add the missing variable for <strong>Production</strong>, <strong>Preview</strong>, and <strong>Development</strong></li>
              <li>Go to <strong>Deployments</strong> tab &rarr; Click <strong>Redeploy</strong> (required for new env vars to build into production)</li>
            </ol>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry Operation</span>
          </button>
        </div>
      </div>
    </div>
  );
}
