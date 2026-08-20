"use client";

import React, { useState, useEffect } from "react";
import { Store, ShieldCheck, ArrowRight, Loader2, CheckCircle2, AlertCircle, RefreshCw, X, KeyRound } from "lucide-react";

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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [customAppKey, setCustomAppKey] = useState("");
  const [useCustomApp, setUseCustomApp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartAuth = () => {
    setStep(3);
    const authUrl = new URL("/api/stores/daraz/auth", window.location.origin);
    if (reconnectStoreId) {
      authUrl.searchParams.set("store_id", reconnectStoreId);
    }
    if (useCustomApp && customAppKey.trim()) {
      authUrl.searchParams.set("app_key", customAppKey.trim());
    }
    window.location.href = authUrl.toString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 relative overflow-hidden">
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
              Official Daraz Open Platform OAuth 2.0 Authorization
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
          <div className={`flex items-center space-x-1.5 ${step >= 1 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>
            <span className="h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[11px] font-bold">1</span>
            <span>Overview</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-200 dark:bg-slate-800" />
          <div className={`flex items-center space-x-1.5 ${step >= 2 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>
            <span className="h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[11px] font-bold">2</span>
            <span>Auth Config</span>
          </div>
          <div className="h-0.5 w-6 bg-slate-200 dark:bg-slate-800" />
          <div className={`flex items-center space-x-1.5 ${step >= 3 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>
            <span className="h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-[11px] font-bold">3</span>
            <span>Authorize</span>
          </div>
        </div>

        {/* Step 1: Overview */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/20 space-y-2">
              <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300 font-bold text-xs">
                <ShieldCheck className="h-4 w-4" />
                <span>Secure OAuth Authorization</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect your official Daraz Seller Center store to LoopTailor ERP. You will be redirected to Daraz Open Platform to log in securely. Tokens are encrypted server-side and never exposed to client browsers.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Automatic official Seller ID and Store Name retrieval</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Isolated product, SKU, stock, and order management</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Automatic initial catalog and order synchronization</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all inline-flex items-center space-x-1.5 apple-press"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Auth Requirements */}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <KeyRound className="h-4 w-4 text-orange-500" />
                <span>Application Credentials</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                By default, LoopTailor ERP uses the server-configured Daraz Open Platform application credentials.
              </p>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={useCustomApp}
                    onChange={(e) => setUseCustomApp(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span>Use custom Daraz App Key (Advanced)</span>
                </label>

                {useCustomApp && (
                  <div className="mt-3 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                      Daraz App Key
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 102938"
                      value={customAppKey}
                      onChange={(e) => setCustomAppKey(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleStartAuth}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-all inline-flex items-center space-x-1.5 apple-press"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Authenticate with Daraz</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Redirecting */}
        {step === 3 && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-orange-500 animate-spin mx-auto" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Connecting to Daraz Open Platform...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Redirecting to official Daraz Seller Center authorization portal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
