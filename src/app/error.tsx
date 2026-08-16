"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Server, ArrowLeft, LogIn } from "lucide-react";

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

  const rawMessage = error?.message || "";
  const isEnvVarError =
    rawMessage.includes("Missing Environment Variable") ||
    rawMessage.includes("environment variable") ||
    rawMessage.includes("SUPABASE");

  const isServerComponentRedacted =
    rawMessage.includes("Server Components render") ||
    rawMessage.includes("omitted in production builds");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3 text-red-400">
          <div className="p-3 bg-red-500/10 rounded-2xl shrink-0">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {isEnvVarError ? "Environment Configuration Notice" : "Application Operational Notice"}
            </h1>
            <p className="text-xs text-slate-400">
              {isEnvVarError
                ? "Vercel Environment Variable Diagnostic"
                : "Runtime Exception & Diagnostics"}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/50 space-y-2">
          <div className="flex items-center space-x-2 text-red-300 font-bold text-xs">
            <Server className="h-4 w-4 shrink-0" />
            <span>Diagnostic Details:</span>
          </div>
          <p className="text-xs font-mono text-red-200 leading-relaxed break-words">
            {rawMessage || "An unhandled server component exception occurred during request execution."}
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400 pt-1 border-t border-red-900/40 mt-1">
              Vercel Error Digest Code: <span className="font-bold text-slate-200">{error.digest}</span>
            </p>
          )}
        </div>

        {isServerComponentRedacted && (
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-2 text-xs text-slate-300">
            <p className="font-bold text-white">Why are exact error details redacted?</p>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              In Next.js production builds on Vercel, detailed internal stack traces are redacted for security to prevent sensitive data leaks. If you recently updated environment variables or database schema, check the steps below.
            </p>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 space-y-2 text-xs text-slate-300">
          <p className="font-bold text-white">Recommended Resolution Steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
            <li>Ensure Vercel Environment Variables (<code className="font-mono text-orange-300">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="font-mono text-orange-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code className="font-mono text-orange-300">SUPABASE_SERVICE_ROLE_KEY</code>) are set in Vercel Project Settings.</li>
            <li>If variables were added recently, click <strong>Redeploy</strong> in Vercel to rebuild the production bundle.</li>
            <li>Click <strong>Retry Loading</strong> below to refresh the active session.</li>
          </ol>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2">
            <a
              href="/dashboard"
              className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Dashboard</span>
            </a>

            <a
              href="/login"
              className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </a>
          </div>

          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry Loading</span>
          </button>
        </div>
      </div>
    </div>
  );
}

