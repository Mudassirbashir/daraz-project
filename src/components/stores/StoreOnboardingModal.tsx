"use client";

import React, { useState, useEffect } from "react";
import { Store, ShieldCheck, ArrowRight, Loader2, CheckCircle2, Copy, Check, X, KeyRound, ExternalLink, HelpCircle } from "lucide-react";

interface StoreOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconnectStoreId?: string | null;
  reconnectStoreName?: string | null;
}

export function StoreOnboardingModal({
  isOpen,
  onClose,
  reconnectStoreId,
  reconnectStoreName,
}: StoreOnboardingModalProps) {
  const [storeUsername, setStoreUsername] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setRedirectUrl(`${origin}/api/stores/daraz/callback`);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setIsAuthorizing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyRedirectUrl = () => {
    if (!redirectUrl) return;
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAuthorize = () => {
    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const authUrl = new URL("/api/stores/daraz/auth", window.location.origin);
      if (reconnectStoreId) {
        authUrl.searchParams.set("store_id", reconnectStoreId);
      }
      if (storeUsername.trim()) {
        authUrl.searchParams.set("store_username", storeUsername.trim());
      }
      if (appKey.trim()) {
        authUrl.searchParams.set("app_key", appKey.trim());
      }
      if (appSecret.trim()) {
        authUrl.searchParams.set("app_secret", appSecret.trim());
      }

      window.location.href = authUrl.toString();
    } catch (err: any) {
      setIsAuthorizing(false);
      setErrorMessage(err.message || "Failed to initiate Daraz authorization.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 pr-8">
          <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20 shrink-0">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {reconnectStoreId ? `Reconnect Store: ${reconnectStoreName || "Daraz Store"}` : "Connect Daraz Store"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Official Daraz Open Platform Onboarding & Authentication
            </p>
          </div>
        </div>

        {/* Onboarding Form */}
        <div className="space-y-4 pt-1 text-xs">
          {/* 1. Store Username */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Store Username (Optional reference)
            </label>
            <input
              type="text"
              placeholder="e.g. isdtraders"
              value={storeUsername}
              onChange={(e) => setStoreUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* 2. Daraz App Key */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
              <span>Daraz App Key</span>
              <span className="text-[10px] font-normal text-slate-400">Leave blank to use system app key</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 102938"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* 3. Daraz App Secret */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
              <span>Daraz App Secret</span>
              <span className="text-[10px] font-normal text-slate-400">Encrypted server-side at rest</span>
            </label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* 4. Redirect URL Display Box */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
              <span>Daraz Redirect / Callback URL</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Auto-Generated</span>
            </label>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={redirectUrl || "https://your-domain.com/api/stores/daraz/callback"}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-mono text-[11px] select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyRedirectUrl}
                className="px-3.5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-sm flex items-center space-x-1.5 shrink-0 apple-press"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied!" : "Copy URL"}</span>
              </button>
            </div>
          </div>

          {/* 5. Step-by-Step Instructions Guide */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
              <HelpCircle className="h-4 w-4 text-orange-500" />
              <span>Daraz Open Platform Setup Steps</span>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              <li>Copy the <strong>Redirect URL</strong> above.</li>
              <li>Open your <strong>Daraz Open Platform</strong> console.</li>
              <li>Select or create your seller application.</li>
              <li>Paste the Redirect URL into the app's authorized callback configuration.</li>
              <li>Copy your <strong>App Key</strong> and <strong>App Secret</strong> into the fields above.</li>
              <li>Click <strong>Authorize with Daraz</strong> below to connect.</li>
            </ol>
          </div>

          {errorMessage && (
            <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-200 dark:border-red-500/20">
              {errorMessage}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isAuthorizing}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleAuthorize}
              disabled={isAuthorizing}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all inline-flex items-center space-x-2 apple-press disabled:opacity-50"
            >
              {isAuthorizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to Daraz...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Authorize with Daraz</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
