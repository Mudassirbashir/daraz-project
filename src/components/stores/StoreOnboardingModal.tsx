"use client";

import React, { useState, useEffect } from "react";
import { Store, ShieldCheck, Loader2, Copy, Check, X, KeyRound, HelpCircle, Eye, EyeOff } from "lucide-react";

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
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setRedirectUrl(`${origin}/api/daraz/oauth/callback`);
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

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/daraz/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_key: appKey.trim(),
          app_secret: appSecret.trim(),
          store_username: storeUsername.trim(),
          reconnect_store_id: reconnectStoreId || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.error || "Failed to initiate Daraz Seller Center authorization.");
      }

      window.location.href = data.authUrl;
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
              Daraz Open Platform Application Credentials & Seller Authorization
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="space-y-4 pt-1 text-xs">
          {/* Step 1: Daraz Open Platform App Credentials */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 text-xs">
              <KeyRound className="h-4 w-4 text-orange-500" />
              <span>Step 1: Daraz Open Platform Credentials</span>
            </h3>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                App Key
              </label>
              <input
                type="text"
                placeholder="Enter App Key from open.daraz.com"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 block flex items-center justify-between">
                <span>App Secret</span>
                <span className="text-[10px] font-normal text-slate-400">Encrypted server-side at rest</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showSecret ? "text" : "password"}
                  placeholder="Enter App Secret from open.daraz.com"
                  value={appSecret}
                  onChange={(e) => setAppSecret(e.target.value)}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 2: Redirect URL Display & Copy */}
          <div className="space-y-2 p-4 rounded-2xl bg-orange-50/60 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/20">
            <h3 className="font-bold text-orange-800 dark:text-orange-300 flex items-center justify-between text-xs">
              <span>Step 2: Your OAuth Redirect URL</span>
              <span className="text-[10px] font-extrabold bg-orange-200 dark:bg-orange-500/30 text-orange-900 dark:text-orange-200 px-2 py-0.5 rounded-lg">Official Callback</span>
            </h3>

            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Copy this URL and add it to your Daraz Open Platform application as the Callback/Redirect URL.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                readOnly
                value={redirectUrl || "https://your-domain.com/api/daraz/oauth/callback"}
                className="flex-1 px-3.5 py-2 rounded-xl border border-orange-200 dark:border-orange-500/30 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-[11px] select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyRedirectUrl}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-sm flex items-center space-x-1.5 shrink-0 apple-press"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copied!" : "Copy Redirect URL"}</span>
              </button>
            </div>
          </div>

          {/* Step 3: Store Username / Label */}
          <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs mb-1">
              Step 3: Store Username / Store Label
            </h3>
            <input
              type="text"
              placeholder="e.g. ISD Traders"
              value={storeUsername}
              onChange={(e) => setStoreUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-[10px] text-slate-400 font-medium pt-0.5">
              This is a user-friendly label. Official store name and Seller ID will be retrieved automatically from Daraz upon authorization.
            </p>
          </div>

          {errorMessage && (
            <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-200 dark:border-red-500/20">
              {errorMessage}
            </p>
          )}

          {/* Step 4: Actions */}
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
                  <span>Authorize Daraz Store</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
